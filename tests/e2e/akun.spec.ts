import { randomUUID } from "node:crypto";

import { expect, test, type Browser, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { auth } from "../../src/server/auth/auth";
import { db } from "../../src/server/db";
import { gudang } from "../../src/server/db/schema";
import { tugaskanOperator } from "../../src/server/gudang/penugasan";
import { EMAIL_ADMIN_E2E, SANDI_ADMIN_E2E } from "./siapkan";

// T138 (PRD A3 ▶ Keputusan 2026-10-20, DESIGN §6 ▶ Keputusan 2026-10-20): operator membuka Akun saya dari nama dan
// perannya di sidebar, lalu mengganti kata sandinya. Perangkat yang sedang dipakai tetap masuk, perangkat lain keluar,
// dan admin melihat kata sandi baru itu di halaman Pengguna.

const SANDI_LAMA = "sandi-lama-e2e-123";
const SANDI_BARU = "sandi-baru-e2e-456";

async function masuk(page: Page, email: string, sandi: string) {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk" }).click();
}

async function perangkatBaru(browser: Browser, email: string, sandi: string) {
  const page = await (await browser.newContext()).newPage();
  await masuk(page, email, sandi);
  await expect(page).not.toHaveURL(/\/masuk/);
  return page;
}

/** Operator = akun bukan admin yang ditugaskan ke gudang aktif. */
async function buatOperator() {
  const nama = `Operator Akun ${randomUUID().slice(0, 8)}`;
  const email = `operator-akun-${randomUUID()}@uji.mandalika.test`;
  const { user } = await auth.api.createUser({ body: { name: nama, email, password: SANDI_LAMA, role: "viewer" } });
  const [cibubur] = await db.select({ id: gudang.id }).from(gudang).where(eq(gudang.nama, "Gudang Cibubur"));
  await tugaskanOperator({ idPengguna: user.id, idGudang: cibubur.id, hakTindakan: [] });
  return { nama, email };
}

test("operator mengganti kata sandi di Akun saya: perangkat ini tetap masuk, perangkat lain keluar, admin melihatnya", async ({
  browser,
}) => {
  const operator = await buatOperator();
  const perangkatLain = await perangkatBaru(browser, operator.email, SANDI_LAMA);
  const page = await perangkatBaru(browser, operator.email, SANDI_LAMA);

  // Nama dan peran di bawah sidebar membuka Akun saya.
  await page.getByRole("link", { name: "Akun saya" }).click();
  await expect(page).toHaveURL(/\/akun$/);
  await expect(page.getByRole("heading", { level: 1, name: "Akun saya" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Akun saya" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(operator.email)).toBeVisible();
  await expect(page.getByText("Admin dapat melihat kata sandi akun ini.", { exact: false })).toBeVisible();

  const saatIni = page.getByLabel("Kata sandi saat ini", { exact: true });
  const baru = page.getByLabel("Kata sandi baru", { exact: true });
  const ulangi = page.getByLabel("Ulangi kata sandi baru", { exact: true });
  const status = page.locator("[data-keadaan]");

  // Tombol mata: tampil dan sembunyi tanpa mengirim form.
  await saatIni.fill("bukan-sandi-ini");
  await baru.fill(SANDI_BARU);
  await ulangi.fill(SANDI_BARU);
  for (const isian of [saatIni, baru, ulangi]) {
    await expect(isian).toHaveAttribute("type", "password");
    const mata = page.locator(`button[aria-controls="${await isian.getAttribute("id")}"]`);
    await mata.click();
    await expect(isian).toHaveAttribute("type", "text");
    await mata.click();
    await expect(isian).toHaveAttribute("type", "password");
  }
  await expect(status).toHaveAttribute("data-keadaan", "belumDisimpan");

  // Kata sandi saat ini salah: ditolak, kata sandi tidak berubah.
  await page.getByRole("button", { name: "Ganti kata sandi" }).click();
  await expect(status).toContainText("Kata sandi saat ini salah.");

  // Kata sandi baru terlalu pendek: pesan berbahasa Indonesia dari server, bukan pesan bawaan browser.
  await saatIni.fill(SANDI_LAMA);
  await baru.fill("1234567");
  await ulangi.fill("1234567");
  await page.getByRole("button", { name: "Ganti kata sandi" }).click();
  await expect(status).toContainText("Kata sandi baru minimal 8 karakter.");

  // Ulangan tidak sama.
  await baru.fill(SANDI_BARU);
  await ulangi.fill(`${SANDI_BARU}-lain`);
  await page.getByRole("button", { name: "Ganti kata sandi" }).click();
  await expect(status).toContainText("Kata sandi baru dan ulangannya tidak sama.");

  await ulangi.fill(SANDI_BARU);
  await page.getByRole("button", { name: "Ganti kata sandi" }).click();
  await expect(status).toHaveText("Kata sandi berhasil diganti. Perangkat lain sudah dikeluarkan.");
  for (const isian of [saatIni, baru, ulangi]) await expect(isian).toHaveValue("");

  // Perangkat ini tetap masuk; perangkat lain keluar.
  await page.reload();
  await expect(page).toHaveURL(/\/akun$/);
  await expect(page.getByRole("heading", { level: 1, name: "Akun saya" })).toBeVisible();
  await perangkatLain.goto("/akun");
  await expect(perangkatLain).toHaveURL(/\/masuk$/);

  // Kata sandi lama gagal, yang baru berhasil.
  await masuk(perangkatLain, operator.email, SANDI_LAMA);
  await expect(perangkatLain).toHaveURL(/\/masuk/);
  await expect(perangkatLain.locator('[data-keadaan="gagal"]')).toBeVisible();
  await masuk(perangkatLain, operator.email, SANDI_BARU);
  await expect(perangkatLain).not.toHaveURL(/\/masuk/);

  // Admin melihat kata sandi baru di halaman Pengguna, diubah oleh operator itu sendiri.
  const admin = await perangkatBaru(browser, EMAIL_ADMIN_E2E, SANDI_ADMIN_E2E);
  await admin.goto("/admin/pengguna");
  const baris = admin.locator("tr", { hasText: operator.email });
  await expect(baris.locator("[data-kata-sandi-diubah]")).toHaveText(new RegExp(`^Diubah .+ oleh ${operator.nama}$`));
  await baris.getByRole("button", { name: "Tampilkan" }).click();
  await expect(baris).toContainText(SANDI_BARU);
});

test("layar ponsel: nama dan peran di menu tarik membuka Akun saya; akun admin tanpa keterangan admin dapat melihat", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await masuk(page, EMAIL_ADMIN_E2E, SANDI_ADMIN_E2E);
  await expect(page).not.toHaveURL(/\/masuk/);

  await page.getByRole("button", { name: "Buka menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Akun saya" }).click();
  await expect(page).toHaveURL(/\/akun$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Akun saya" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Ganti kata sandi" })).toBeVisible();
  await expect(page.getByText("Admin dapat melihat kata sandi akun ini.", { exact: false })).toHaveCount(0);
});
