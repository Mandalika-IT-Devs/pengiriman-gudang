import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/auth/auth";
import { catatKataSandi } from "@/server/auth/catatan-kata-sandi";
import { buatPenggunaUji, kepalaPenggunaUji, sandiUji } from "@/server/auth/uji-bantu";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { idGudangUji } from "@/server/gudang/uji-bantu";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

const kepala = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));

import HalamanPengguna from "./page";

beforeEach(() => {
  kepala.cookie = "";
});

/** Isi baris tabel (`<tr>`) yang memuat `email`. */
function barisDari(html: string, email: string) {
  return [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map((m) => m[1]!).find((isi) => isi.includes(email)) ?? "";
}

/** Teks tanpa tag dari elemen pertama ber-atribut `atribut` di `isi`. */
function teksElemen(isi: string, atribut: string) {
  const cocok = new RegExp(`<(\\w+)[^>]*\\s${atribut}(?:="[^"]*")?[^>]*>(.*?)</\\1>`).exec(isi);
  return cocok ? cocok[2]!.replace(/<[^>]+>/g, "") : undefined;
}

describe("/admin/pengguna", () => {
  it("belum masuk → diarahkan ke halaman masuk", async () => {
    await expect(HalamanPengguna()).rejects.toMatchObject({ digest: expect.stringContaining("/masuk") });
  });

  it("viewer → 404", async () => {
    kepala.cookie = (await kepalaPenggunaUji("viewer")).cookie;
    await expect(HalamanPengguna()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("admin melihat form buat pengguna dan daftar pengguna dengan peran dan status", async () => {
    const lain = await buatPenggunaUji("viewer");
    kepala.cookie = (await kepalaPenggunaUji("admin")).cookie;
    const html = renderToStaticMarkup(await HalamanPengguna());
    expect(html).toContain("Buat pengguna");
    expect(html).toContain(lain.email);
    expect(html).toContain('data-status="aktif"');
    expect(html).toContain("Nonaktifkan");
    // Zona kerja: judul halaman text-2xl md:text-3xl, tanpa blob.
    expect(html).toContain("text-2xl font-bold md:text-3xl");
    expect(html).not.toContain("blur-3xl");
  });

  it("peran tampil seperti sidebar (Admin/Operator/Viewer); pilihan peran berbunyi Admin / Bukan admin; baris akun sendiri tanpa Nonaktifkan (DESIGN §11.9)", async () => {
    const operator = await buatPenggunaUji("viewer");
    await tugaskanOperator({ idPengguna: operator.id, idGudang: await idGudangUji("Gudang Cibubur"), hakTindakan: [] });
    const viewer = await buatPenggunaUji("viewer");
    const adminLain = await buatPenggunaUji("admin");
    const saya = await kepalaPenggunaUji("admin");
    kepala.cookie = saya.cookie;
    const html = renderToStaticMarkup(await HalamanPengguna());
    const baris = (email: string) =>
      [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map((m) => m[1]!).find((isi) => isi.includes(email)) ?? "";
    const peranTampil = (email: string) => /<span data-peran-tampil="[^"]+"[^>]*>([^<]*)<\/span>/.exec(baris(email))?.[1];

    expect(peranTampil(operator.email)).toBe("Operator");
    expect(peranTampil(viewer.email)).toBe("Viewer");
    expect(peranTampil(adminLain.email)).toBe("Admin");
    expect(peranTampil(saya.email)).toBe("Admin");
    expect(html).not.toContain(">viewer<");

    // Pilihan peran: nilai tersimpan tetap admin/viewer, bunyinya Admin / Bukan admin (...).
    expect(baris(operator.email)).toContain("Bukan admin (operator atau viewer, menurut penugasan)");
    expect(baris(viewer.email)).toContain("Bukan admin (operator atau viewer, menurut penugasan)");
    expect(baris(adminLain.email)).toContain(">Admin<");

    // Baris akun sendiri tanpa tombol Nonaktifkan; akun lain tetap punya.
    expect(baris(saya.email)).not.toContain("Nonaktifkan");
    expect(baris(adminLain.email)).toContain("Nonaktifkan");
    expect(baris(viewer.email)).toContain("Nonaktifkan");
  });

  it("tombol Aktifkan kembali hanya untuk pengguna nonaktif", async () => {
    const nonaktif = await buatPenggunaUji("viewer");
    await db.update(user).set({ banned: true }).where(eq(user.id, nonaktif.id));
    kepala.cookie = (await kepalaPenggunaUji("admin")).cookie;
    const html = renderToStaticMarkup(await HalamanPengguna());
    const jumlahNonaktif = html.split(">Nonaktif<").length - 1;
    expect(jumlahNonaktif).toBeGreaterThan(0);
    expect(html.split(">Aktifkan kembali<").length - 1).toBe(jumlahNonaktif);
  });
});

describe("/admin/pengguna: kolom Kata sandi (T137, PRD A3 ▶ Keputusan 2026-10-20)", () => {
  it("akun bukan admin yang dibuat admin: tersembunyi dengan Tampilkan, keterangan Diubah … oleh <admin>; kata sandi tidak ikut di HTML maupun data halaman", async () => {
    const saya = await kepalaPenggunaUji("admin");
    await db.update(user).set({ name: "Admin Pengatur T137" }).where(eq(user.id, saya.id));
    const target = await buatPenggunaUji("viewer");
    await catatKataSandi({ idPengguna: target.id, sandi: sandiUji, olehId: saya.id });
    kepala.cookie = saya.cookie;

    const halaman = await HalamanPengguna();
    const html = renderToStaticMarkup(halaman);
    const baris = barisDari(html, target.email);
    expect(html).toContain(">Kata sandi<");
    expect(teksElemen(baris, 'data-kata-sandi="tersembunyi"')).toContain("••••••••");
    expect(baris).toContain(">Tampilkan<");
    expect(teksElemen(baris, "data-kata-sandi-diubah")).toMatch(/^Diubah \w+, \d{2}-\d{2}-\d{4} oleh Admin Pengatur T137$/);

    expect(html).not.toContain(sandiUji);
    // Data yang dikirim ke komponen klien (payload RSC) juga tanpa kata sandi.
    expect(JSON.stringify(halaman, (kunci, nilai: unknown) => (kunci.startsWith("_") ? undefined : nilai))).not.toContain(
      sandiUji,
    );
  });

  it("akun admin: Kata sandi —; akun yang dibuat sebelum fitur ini: Belum tersedia dan —", async () => {
    const saya = await kepalaPenggunaUji("admin");
    const adminLain = await buatPenggunaUji("admin");
    await catatKataSandi({ idPengguna: adminLain.id, sandi: sandiUji, olehId: saya.id });
    const lama = await buatPenggunaUji("viewer");
    kepala.cookie = saya.cookie;

    const html = renderToStaticMarkup(await HalamanPengguna());
    const barisAdmin = barisDari(html, adminLain.email);
    expect(teksElemen(barisAdmin, 'data-kata-sandi="admin"')).toBe("—");
    expect(barisAdmin).not.toContain(">Tampilkan<");
    expect(teksElemen(barisAdmin, "data-kata-sandi-diubah")).toMatch(/^Diubah .+ oleh Uji admin$/);

    const barisLama = barisDari(html, lama.email);
    expect(teksElemen(barisLama, 'data-kata-sandi="belumTersedia"')).toContain("Belum tersedia");
    expect(barisLama).toContain("Tersedia setelah pengguna mengganti kata sandinya atau admin mengatur ulang.");
    expect(barisLama).not.toContain(">Tampilkan<");
    expect(teksElemen(barisLama, "data-kata-sandi-diubah")).toBe("—");
  });

  it("salinan yang tidak terbaca lagi (kata sandi berganti di luar catatan) tampil Belum tersedia", async () => {
    const saya = await kepalaPenggunaUji("admin");
    const target = await buatPenggunaUji("viewer");
    await catatKataSandi({ idPengguna: target.id, sandi: sandiUji, olehId: saya.id });
    await auth.api.setUserPassword({
      body: { userId: target.id, newPassword: "Sandi-Lain-12345" },
      headers: new Headers({ cookie: saya.cookie }),
    });
    kepala.cookie = saya.cookie;

    const baris = barisDari(renderToStaticMarkup(await HalamanPengguna()), target.email);
    expect(teksElemen(baris, 'data-kata-sandi="belumTersedia"')).toContain("Belum tersedia");
  });

  it("tombol Atur ulang kata sandi di setiap baris kecuali akun sendiri", async () => {
    const viewer = await buatPenggunaUji("viewer");
    const adminLain = await buatPenggunaUji("admin");
    const saya = await kepalaPenggunaUji("admin");
    kepala.cookie = saya.cookie;

    const html = renderToStaticMarkup(await HalamanPengguna());
    expect(barisDari(html, saya.email)).not.toContain("Atur ulang kata sandi");
    expect(barisDari(html, viewer.email)).toContain("Atur ulang kata sandi");
    expect(barisDari(html, adminLain.email)).toContain("Atur ulang kata sandi");
  });
});
