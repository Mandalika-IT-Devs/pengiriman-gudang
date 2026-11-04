import { expect, test } from "@playwright/test";

import { EMAIL_ADMIN_E2E, SANDI_ADMIN_E2E } from "./siapkan";

// T147 — PRD A3 ▶ Keputusan 2026-11-04 (UAT A3.1, U9.3): admin tanpa penugasan memegang kelima hak tindakan di setiap
// gudang aktif. Sidebar admin menampilkan "Kirim di luar jadwal" tepat setelah Pengiriman Gudang; admin tetap melihat
// daftar gudang lebih dulu, dan halaman gudang aktif tampil tanpa label "Hanya-baca".

test("admin tanpa penugasan: Pekerjaan rutin berisi Kirim di luar jadwal; halaman gudang aktif tanpa Hanya-baca", async ({ page }) => {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(EMAIL_ADMIN_E2E);
  await page.getByLabel("Kata sandi").fill(SANDI_ADMIN_E2E);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).not.toHaveURL(/\/masuk/);

  const navigasi = page.getByRole("navigation", { name: "Navigasi utama" });
  await navigasi.getByRole("button", { name: "Pekerjaan rutin" }).click();
  const kelompok = navigasi.getByRole("region", { name: "Pekerjaan rutin" });
  await expect(kelompok.getByRole("link")).toHaveText([
    "Impor penjualan",
    "Ranking pusat",
    "Persetujuan jadwal",
    "Pengiriman Gudang",
    "Kirim di luar jadwal",
  ]);

  await kelompok.getByRole("link", { name: "Pengiriman Gudang" }).click();
  await expect(page).toHaveURL(/\/pengiriman-gudang$/);
  await page
    .getByRole("list", { name: "Gudang" })
    .getByRole("link", { name: /^Gudang Bali/ })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pengiriman Gudang — Gudang Bali");
  await expect(page.locator("[data-hanya-baca]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hitung kebutuhan", exact: true })).toBeVisible();
});
