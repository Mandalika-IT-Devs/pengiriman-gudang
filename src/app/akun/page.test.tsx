import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { idGudangUji } from "@/server/gudang/uji-bantu";

// T138: halaman Akun saya (CONTEXT "Akun saya", PRD A3 ▶ Keputusan 2026-10-20, DESIGN §6 ▶ Keputusan 2026-10-20).

const kepala = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));

import HalamanAkun from "./page";

const KETERANGAN_ADMIN_MELIHAT =
  "Admin dapat melihat kata sandi akun ini. Jangan memakai kata sandi yang juga Anda pakai di tempat lain.";

beforeEach(() => {
  kepala.cookie = "";
});

/** Nilai hanya-baca di daftar data akun (`<dt>label</dt><dd>nilai</dd>`). */
function dataAkun(html: string, label: string) {
  return new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>([^<]*)</dd>`).exec(html)?.[1];
}

/** Masuk sebagai akun uji bernama `nama`; `operator` = bukan admin yang ditugaskan ke gudang aktif. */
async function masukSebagai(peran: "admin" | "operator" | "viewer", nama: string) {
  const akun = await kepalaPenggunaUji(peran === "admin" ? "admin" : "viewer");
  await db.update(user).set({ name: nama }).where(eq(user.id, akun.id));
  if (peran === "operator") {
    await tugaskanOperator({ idPengguna: akun.id, idGudang: await idGudangUji("Gudang Cibubur"), hakTindakan: [] });
  }
  kepala.cookie = akun.cookie;
  return akun;
}

describe("/akun", () => {
  it("belum masuk → diarahkan ke halaman masuk", async () => {
    await expect(HalamanAkun()).rejects.toMatchObject({ digest: expect.stringContaining("/masuk") });
  });

  it.each([
    ["admin", "Admin"],
    ["operator", "Operator"],
    ["viewer", "Viewer"],
  ] as const)("%s: judul Akun saya, nama, email, dan peran (label sidebar) hanya-baca", async (peran, labelPeran) => {
    const akun = await masukSebagai(peran, `Pengguna Akun ${labelPeran}`);
    const html = renderToStaticMarkup(await HalamanAkun());

    expect(html).toMatch(/<h1[^>]*>Akun saya<\/h1>/);
    expect(dataAkun(html, "Nama")).toBe(`Pengguna Akun ${labelPeran}`);
    expect(dataAkun(html, "Email")).toBe(akun.email);
    expect(dataAkun(html, "Peran")).toBe(labelPeran);
    // Hanya-baca: satu-satunya isian adalah ketiga isian kata sandi.
    expect(html.match(/<input /g)).toHaveLength(3);
    // Zona kerja (DESIGN §1) dengan lebar form tunggal (§9).
    expect(html).toContain("text-2xl font-bold md:text-3xl");
    expect(html).toContain("max-w-3xl");
    expect(html).not.toContain("blur-3xl");
  });

  it("form Ganti kata sandi: tiga isian berlabel, tersembunyi, masing-masing dengan tombol mata; tombol Ganti kata sandi", async () => {
    await masukSebagai("operator", "Operator Form");
    const html = renderToStaticMarkup(await HalamanAkun());

    expect(html).toMatch(/<h2[^>]*>Ganti kata sandi<\/h2>/);
    for (const label of ["Kata sandi saat ini", "Kata sandi baru", "Ulangi kata sandi baru"]) {
      const id = new RegExp(`<label[^>]*for="([^"]+)"[^>]*>${label}</label>`).exec(html)?.[1];
      expect(id, label).toBeDefined();
      expect(html).toMatch(new RegExp(`<input[^>]*id="${id}"[^>]*type="password"|<input[^>]*type="password"[^>]*id="${id}"`));
      expect(html).toContain(`aria-controls="${id}"`);
    }
    expect(html.match(/aria-label="Tampilkan kata sandi"/g)).toHaveLength(3);
    expect(html).toMatch(/<button [^>]*type="submit"[^>]*>Ganti kata sandi<\/button>/);
  });

  it.each([
    ["operator", true],
    ["viewer", true],
    ["admin", false],
  ] as const)("%s: keterangan 'Admin dapat melihat…' tampil = %s", async (peran, tampil) => {
    await masukSebagai(peran, `Keterangan ${peran}`);
    const html = renderToStaticMarkup(await HalamanAkun());
    expect(html.includes(KETERANGAN_ADMIN_MELIHAT)).toBe(tampil);
  });
});
