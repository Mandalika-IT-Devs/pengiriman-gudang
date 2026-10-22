import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/auth/auth";
import { AksesDitolakError } from "@/server/auth/kewenangan";
import { buatPenggunaUji, emailUnik, kepalaPenggunaUji, masukUji, sandiUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { catatanKataSandi, user } from "@/server/db/schema";

// T137 (PRD A3 ▶ Keputusan 2026-10-20): admin melihat kata sandi terbaru akun bukan admin dan mengatur ulang kata sandi
// akun lain. Salinan terenkripsi ditulis setiap kali admin mengisi kata sandi akun bukan admin.

const kepala = vi.hoisted(() => ({ cookie: "", muatUlangGagal: false }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => {
    if (kepala.muatUlangGagal) throw new Error("gagal memuat ulang");
  },
}));

import { aturUlangKataSandi, buatPengguna, tampilkanKataSandi, ubahPeran } from "./aksi";

async function idDariEmail(email: string) {
  const [baris] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!baris) throw new Error(`Pengguna ${email} tidak ada.`);
  return baris.id;
}

async function catatan(idPengguna: string) {
  const [baris] = await db.select().from(catatanKataSandi).where(eq(catatanKataSandi.userId, idPengguna));
  return baris;
}

async function sesiMasihBerlaku(cookie: string) {
  return (await auth.api.getSession({ headers: new Headers({ cookie }) })) !== null;
}

let admin: Awaited<ReturnType<typeof kepalaPenggunaUji>>;

beforeEach(async () => {
  kepala.muatUlangGagal = false;
  admin = await kepalaPenggunaUji("admin");
  kepala.cookie = admin.cookie;
});

describe("membuat akun", () => {
  it("akun bukan admin: kata sandinya bisa ditampilkan admin", async () => {
    const email = emailUnik("bukan-admin");
    await expect(buatPengguna({ nama: "Sari", email, sandi: "Sandi-Sari-2026", peran: "viewer" })).resolves.toEqual({
      keadaan: "berhasil",
    });
    await expect(tampilkanKataSandi({ idPengguna: await idDariEmail(email) })).resolves.toEqual({
      keadaan: "tersedia",
      sandi: "Sandi-Sari-2026",
    });
  });

  it("akun admin: hanya waktu dan pembuat yang dicatat, tanpa salinan; kata sandinya tidak ditampilkan", async () => {
    const email = emailUnik("admin-baru");
    await expect(buatPengguna({ nama: "Adi", email, sandi: "Sandi-Adi-2026", peran: "admin" })).resolves.toEqual({
      keadaan: "berhasil",
    });
    const id = await idDariEmail(email);
    expect(await catatan(id)).toMatchObject({ salinanTerenkripsi: null, diisiOleh: admin.id, diisiPada: expect.any(Date) });
    await expect(tampilkanKataSandi({ idPengguna: id })).resolves.toEqual({
      keadaan: "gagal",
      pesan: "Kata sandi akun admin tidak ditampilkan.",
    });
  });
});

describe("akun yang dibuat sebelum fitur ini (tanpa catatan)", () => {
  it("kata sandinya belum tersedia", async () => {
    const lama = await buatPenggunaUji("viewer");
    expect(await catatan(lama.id)).toBeUndefined();
    await expect(tampilkanKataSandi({ idPengguna: lama.id })).resolves.toEqual({ keadaan: "belumTersedia" });
  });
});

describe("atur ulang kata sandi", () => {
  it("akun bukan admin: kata sandi lama gagal, yang baru berhasil, sesi lama berakhir, salinan baru tampil", async () => {
    const target = await kepalaPenggunaUji("viewer");
    const sesiLain = await masukUji(target.email);
    expect(await sesiMasihBerlaku(target.cookie)).toBe(true);

    await expect(
      aturUlangKataSandi({ idPengguna: target.id, sandiBaru: "Sandi-Baru-77", ulangiSandiBaru: "Sandi-Baru-77" }),
    ).resolves.toEqual({ keadaan: "berhasil" });

    await expect(masukUji(target.email, sandiUji)).rejects.toThrow();
    await expect(masukUji(target.email, "Sandi-Baru-77")).resolves.toContain("session_token");
    expect(await sesiMasihBerlaku(target.cookie)).toBe(false);
    expect(await sesiMasihBerlaku(sesiLain)).toBe(false);
    await expect(tampilkanKataSandi({ idPengguna: target.id })).resolves.toEqual({
      keadaan: "tersedia",
      sandi: "Sandi-Baru-77",
    });
    expect(await catatan(target.id)).toMatchObject({ diisiOleh: admin.id });
  });

  it("isian tidak valid → gagal dengan pesan; kata sandi lama tetap berlaku", async () => {
    const target = await buatPenggunaUji("viewer");
    const atur = (sandiBaru: string, ulangiSandiBaru = sandiBaru) =>
      aturUlangKataSandi({ idPengguna: target.id, sandiBaru, ulangiSandiBaru });
    await expect(atur("1234567")).resolves.toEqual({ keadaan: "gagal", pesan: "Kata sandi minimal 8 karakter." });
    await expect(atur("x".repeat(129))).resolves.toEqual({ keadaan: "gagal", pesan: "Kata sandi terlalu panjang." });
    await expect(atur("Sandi-Baru-77", "Sandi-Baru-78")).resolves.toEqual({
      keadaan: "gagal",
      pesan: "Ulangan kata sandi baru tidak sama.",
    });
    await expect(masukUji(target.email)).resolves.toContain("session_token");
    expect(await catatan(target.id)).toBeUndefined();
  });

  it("8 dan 128 karakter diterima", async () => {
    const target = await buatPenggunaUji("viewer");
    for (const sandiBaru of ["12345678", "y".repeat(128)]) {
      await expect(aturUlangKataSandi({ idPengguna: target.id, sandiBaru, ulangiSandiBaru: sandiBaru })).resolves.toEqual({
        keadaan: "berhasil",
      });
      await expect(masukUji(target.email, sandiBaru)).resolves.toContain("session_token");
    }
  });

  it("akun sendiri ditolak server; kata sandi dan sesinya tetap", async () => {
    await expect(
      aturUlangKataSandi({ idPengguna: admin.id, sandiBaru: "Sandi-Baru-77", ulangiSandiBaru: "Sandi-Baru-77" }),
    ).resolves.toEqual({ keadaan: "gagal", pesan: "Kata sandi akun sendiri tidak bisa diatur ulang di sini." });
    expect(await sesiMasihBerlaku(admin.cookie)).toBe(true);
    await expect(masukUji(admin.email)).resolves.toContain("session_token");
  });

  it("akun admin lain: kata sandi diganti tanpa salinan, waktu dan admin pengatur dicatat", async () => {
    const target = await kepalaPenggunaUji("admin");
    await expect(
      aturUlangKataSandi({ idPengguna: target.id, sandiBaru: "Sandi-Admin-77", ulangiSandiBaru: "Sandi-Admin-77" }),
    ).resolves.toEqual({ keadaan: "berhasil" });
    await expect(masukUji(target.email, "Sandi-Admin-77")).resolves.toContain("session_token");
    expect(await sesiMasihBerlaku(target.cookie)).toBe(false);
    expect(await catatan(target.id)).toMatchObject({ salinanTerenkripsi: null, diisiOleh: admin.id });
  });

  it("pengguna yang tidak ada → gagal", async () => {
    await expect(
      aturUlangKataSandi({ idPengguna: "tidak-ada", sandiBaru: "Sandi-Baru-77", ulangiSandiBaru: "Sandi-Baru-77" }),
    ).resolves.toEqual({ keadaan: "gagal", pesan: "Pengguna tidak ditemukan." });
  });

  it("tersimpan tetapi gagal memuat ulang tampilan", async () => {
    const target = await buatPenggunaUji("viewer");
    kepala.muatUlangGagal = true;
    await expect(
      aturUlangKataSandi({ idPengguna: target.id, sandiBaru: "Sandi-Baru-77", ulangiSandiBaru: "Sandi-Baru-77" }),
    ).resolves.toEqual({ keadaan: "tersimpanGagalMuatUlang" });
    await expect(masukUji(target.email, "Sandi-Baru-77")).resolves.toContain("session_token");
  });
});

describe("pengguna bukan admin ditolak di server", () => {
  it("tampilkan dan atur ulang kata sandi ditolak; tidak ada yang berubah", async () => {
    const email = emailUnik("dilihat");
    await buatPengguna({ nama: "Target", email, sandi: "Sandi-Target-1", peran: "viewer" });
    const idTarget = await idDariEmail(email);

    kepala.cookie = (await kepalaPenggunaUji("viewer")).cookie;
    await expect(tampilkanKataSandi({ idPengguna: idTarget })).rejects.toBeInstanceOf(AksesDitolakError);
    await expect(
      aturUlangKataSandi({ idPengguna: idTarget, sandiBaru: "Sandi-Baru-77", ulangiSandiBaru: "Sandi-Baru-77" }),
    ).rejects.toBeInstanceOf(AksesDitolakError);
    await expect(masukUji(email, "Sandi-Target-1")).resolves.toContain("session_token");

    kepala.cookie = "";
    await expect(tampilkanKataSandi({ idPengguna: idTarget })).rejects.toMatchObject({
      digest: expect.stringContaining("/masuk"),
    });
    await expect(
      aturUlangKataSandi({ idPengguna: idTarget, sandiBaru: "Sandi-Baru-77", ulangiSandiBaru: "Sandi-Baru-77" }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("/masuk") });
    await expect(masukUji(email, "Sandi-Target-1")).resolves.toContain("session_token");
  });
});

describe("ubah peran menjadi admin", () => {
  it("salinan kata sandinya dihapus; waktu dan pengisi tetap", async () => {
    const email = emailUnik("naik-admin");
    await buatPengguna({ nama: "Naik", email, sandi: "Sandi-Naik-2026", peran: "viewer" });
    const id = await idDariEmail(email);
    const sebelum = await catatan(id);
    expect(sebelum?.salinanTerenkripsi).not.toBeNull();

    await expect(ubahPeran({ idPengguna: id, peran: "admin" })).resolves.toEqual({ keadaan: "berhasil" });
    expect(await catatan(id)).toEqual({ ...sebelum, salinanTerenkripsi: null });
    await expect(tampilkanKataSandi({ idPengguna: id })).resolves.toMatchObject({ keadaan: "gagal" });

    // Kembali menjadi bukan admin: salinan tidak muncul lagi sampai kata sandi diisi ulang.
    await expect(ubahPeran({ idPengguna: id, peran: "viewer" })).resolves.toEqual({ keadaan: "berhasil" });
    await expect(tampilkanKataSandi({ idPengguna: id })).resolves.toEqual({ keadaan: "belumTersedia" });
  });
});

describe("salinan yang tampil tidak pernah berbeda dari kata sandi yang berlaku", () => {
  it("hash berganti tanpa salinan baru tertulis → salinan lama tidak tampil lagi (Belum tersedia)", async () => {
    const email = emailUnik("hash-berganti");
    await buatPengguna({ nama: "Rina", email, sandi: "Sandi-Rina-Lama", peran: "viewer" });
    const id = await idDariEmail(email);
    await expect(tampilkanKataSandi({ idPengguna: id })).resolves.toMatchObject({ keadaan: "tersedia" });

    // Seperti penulisan salinan yang gagal setelah Better Auth mengganti hash.
    await auth.api.setUserPassword({
      body: { userId: id, newPassword: "Sandi-Rina-Baru" },
      headers: new Headers({ cookie: admin.cookie }),
    });
    await expect(tampilkanKataSandi({ idPengguna: id })).resolves.toEqual({ keadaan: "belumTersedia" });
  });
});

describe("kata sandi tidak tersimpan atau tertulis dalam bentuk terbaca", () => {
  it("isi tabel akun dan catatan kata sandi (seperti backup pg_dump) tidak memuat kata sandi", async () => {
    const email = emailUnik("tidak-terbaca");
    await buatPengguna({ nama: "Dewi", email, sandi: "Sandi-Dewi-Rahasia-1", peran: "viewer" });
    const id = await idDariEmail(email);
    await aturUlangKataSandi({ idPengguna: id, sandiBaru: "Sandi-Dewi-Rahasia-2", ulangiSandiBaru: "Sandi-Dewi-Rahasia-2" });
    await expect(tampilkanKataSandi({ idPengguna: id })).resolves.toMatchObject({ sandi: "Sandi-Dewi-Rahasia-2" });

    const isi = await db.execute<{ baris: string }>(sql`
      select row_to_json(c)::text as baris from catatan_kata_sandi c
      union all select row_to_json(a)::text from account a
      union all select row_to_json(u)::text from "user" u
      union all select row_to_json(s)::text from session s`);
    const semua = isi.map((b) => b.baris).join("\n");
    expect(semua).toContain(id);
    expect(semua).not.toContain("Sandi-Dewi-Rahasia");
  });

  it("tidak ada kata sandi yang ditulis ke log", async () => {
    const tertulis: unknown[] = [];
    const metode = ["log", "info", "warn", "error", "debug", "trace"] as const;
    const pengintai = metode.map((m) => vi.spyOn(console, m).mockImplementation((...arg: unknown[]) => tertulis.push(...arg)));
    try {
      const email = emailUnik("log");
      await buatPengguna({ nama: "Log", email, sandi: "Sandi-Log-Pertama", peran: "viewer" });
      const id = await idDariEmail(email);
      await tampilkanKataSandi({ idPengguna: id });
      await aturUlangKataSandi({ idPengguna: id, sandiBaru: "Sandi-Log-Kedua", ulangiSandiBaru: "Sandi-Log-Kedua" });
      await aturUlangKataSandi({ idPengguna: id, sandiBaru: "Sandi-Log-Ketiga", ulangiSandiBaru: "Sandi-Log-Berbeda" });
      await tampilkanKataSandi({ idPengguna: id });
    } finally {
      for (const p of pengintai) p.mockRestore();
    }
    expect(tertulis.map((arg) => (typeof arg === "string" ? arg : (JSON.stringify(arg) ?? String(arg)))).join("\n")).not.toContain(
      "Sandi-Log",
    );
  });
});
