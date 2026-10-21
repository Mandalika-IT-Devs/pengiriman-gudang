import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/auth/auth";
import { kepalaPenggunaUji, masukUji, sandiUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { catatanKataSandi, user } from "@/server/db/schema";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { idGudangUji } from "@/server/gudang/uji-bantu";

// T138 (PRD A3 ▶ Keputusan 2026-10-20, GLOSSARY "Akun saya"): setiap pengguna yang sudah masuk mengganti kata sandinya
// sendiri. Sesi di perangkat lain berakhir; perangkat yang sedang dipakai tetap masuk. Akun bukan admin menyimpan salinan
// terenkripsi lewat modul T137 sehingga admin bisa melihatnya; akun admin hanya mencatat waktu dan pengisi.

const kepala = vi.hoisted(() => ({ cookie: "", muatUlangGagal: false }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => {
    if (kepala.muatUlangGagal) throw new Error("gagal memuat ulang");
  },
}));

import { tampilkanKataSandi } from "../admin/pengguna/aksi";
import { gantiKataSandi } from "./aksi";

const SANDI_BARU = "Sandi-Baru-Akun-77";

async function sesiMasihBerlaku(cookie: string) {
  return (await auth.api.getSession({ headers: new Headers({ cookie }) })) !== null;
}

async function catatan(idPengguna: string) {
  const [baris] = await db.select().from(catatanKataSandi).where(eq(catatanKataSandi.userId, idPengguna));
  return baris;
}

/** Operator = akun bukan admin yang ditugaskan ke gudang aktif (GLOSSARY.md). Masuk di "perangkat ini". */
async function operatorMasuk() {
  const operator = await kepalaPenggunaUji("viewer");
  await tugaskanOperator({ idPengguna: operator.id, idGudang: await idGudangUji("Gudang Cibubur"), hakTindakan: [] });
  kepala.cookie = operator.cookie;
  return operator;
}

const ganti = (sandiBaru: string, ulangiSandiBaru = sandiBaru, sandiSaatIni = sandiUji) =>
  gantiKataSandi({ sandiSaatIni, sandiBaru, ulangiSandiBaru });

beforeEach(() => {
  kepala.cookie = "";
  kepala.muatUlangGagal = false;
});

describe("ganti kata sandi sendiri", () => {
  it("operator: kata sandi lama gagal, yang baru berhasil; perangkat lain keluar, perangkat ini tetap masuk", async () => {
    const operator = await operatorMasuk();
    const perangkatLain = await masukUji(operator.email);
    expect(await sesiMasihBerlaku(perangkatLain)).toBe(true);

    await expect(ganti(SANDI_BARU)).resolves.toEqual({ keadaan: "berhasil" });

    await expect(masukUji(operator.email, sandiUji)).rejects.toThrow();
    await expect(masukUji(operator.email, SANDI_BARU)).resolves.toContain("session_token");
    expect(await sesiMasihBerlaku(perangkatLain)).toBe(false);
    expect(await sesiMasihBerlaku(operator.cookie)).toBe(true);
  });

  it("operator: admin melihat kata sandi baru, tercatat diisi oleh operator itu sendiri", async () => {
    const operator = await operatorMasuk();
    await expect(ganti(SANDI_BARU)).resolves.toEqual({ keadaan: "berhasil" });
    expect(await catatan(operator.id)).toMatchObject({ diisiOleh: operator.id, diisiPada: expect.any(Date) });

    kepala.cookie = (await kepalaPenggunaUji("admin")).cookie;
    await expect(tampilkanKataSandi({ idPengguna: operator.id })).resolves.toEqual({ keadaan: "tersedia", sandi: SANDI_BARU });
  });

  it("viewer tanpa penugasan juga bisa; salinannya tersedia bagi admin", async () => {
    const viewer = await kepalaPenggunaUji("viewer");
    kepala.cookie = viewer.cookie;
    await expect(ganti(SANDI_BARU)).resolves.toEqual({ keadaan: "berhasil" });
    await expect(masukUji(viewer.email, SANDI_BARU)).resolves.toContain("session_token");

    kepala.cookie = (await kepalaPenggunaUji("admin")).cookie;
    await expect(tampilkanKataSandi({ idPengguna: viewer.id })).resolves.toEqual({ keadaan: "tersedia", sandi: SANDI_BARU });
  });

  it("admin mengganti kata sandinya sendiri: tanpa salinan, hanya waktu dan pengisi; sesi sendiri tetap", async () => {
    const admin = await kepalaPenggunaUji("admin");
    const perangkatLain = await masukUji(admin.email);
    kepala.cookie = admin.cookie;

    await expect(ganti(SANDI_BARU)).resolves.toEqual({ keadaan: "berhasil" });

    await expect(masukUji(admin.email, SANDI_BARU)).resolves.toContain("session_token");
    await expect(masukUji(admin.email, sandiUji)).rejects.toThrow();
    expect(await sesiMasihBerlaku(admin.cookie)).toBe(true);
    expect(await sesiMasihBerlaku(perangkatLain)).toBe(false);
    expect(await catatan(admin.id)).toMatchObject({ salinanTerenkripsi: null, diisiOleh: admin.id, diisiPada: expect.any(Date) });
  });

  it("8 dan 128 karakter diterima", async () => {
    const operator = await operatorMasuk();
    let sandiSaatIni = sandiUji;
    for (const sandiBaru of ["12345678", "y".repeat(128)]) {
      await expect(ganti(sandiBaru, sandiBaru, sandiSaatIni)).resolves.toEqual({ keadaan: "berhasil" });
      await expect(masukUji(operator.email, sandiBaru)).resolves.toContain("session_token");
      sandiSaatIni = sandiBaru;
    }
  });

  it("tersimpan tetapi gagal memuat ulang tampilan", async () => {
    const operator = await operatorMasuk();
    kepala.muatUlangGagal = true;
    await expect(ganti(SANDI_BARU)).resolves.toEqual({ keadaan: "tersimpanGagalMuatUlang" });
    await expect(masukUji(operator.email, SANDI_BARU)).resolves.toContain("session_token");
  });
});

describe("isian ditolak: kata sandi tidak berubah dan perangkat lain tetap masuk", () => {
  it.each([
    ["kata sandi saat ini salah", () => ganti(SANDI_BARU, SANDI_BARU, "bukan-sandi-ini"), "Kata sandi saat ini salah."],
    ["kata sandi saat ini kosong", () => ganti(SANDI_BARU, SANDI_BARU, ""), "Kata sandi saat ini salah."],
    ["kata sandi baru kurang dari 8 karakter", () => ganti("1234567"), "Kata sandi baru minimal 8 karakter."],
    ["kata sandi baru lebih dari 128 karakter", () => ganti("x".repeat(129)), "Kata sandi baru maksimal 128 karakter."],
    ["ulangan tidak sama", () => ganti(SANDI_BARU, `${SANDI_BARU}-lain`), "Kata sandi baru dan ulangannya tidak sama."],
  ])("%s", async (_kasus, aksi, pesan) => {
    const operator = await operatorMasuk();
    const perangkatLain = await masukUji(operator.email);

    await expect(aksi()).resolves.toEqual({ keadaan: "gagal", pesan });

    await expect(masukUji(operator.email, sandiUji)).resolves.toContain("session_token");
    await expect(masukUji(operator.email, SANDI_BARU)).rejects.toThrow();
    expect(await sesiMasihBerlaku(perangkatLain)).toBe(true);
    expect(await sesiMasihBerlaku(operator.cookie)).toBe(true);
    expect(await catatan(operator.id)).toBeUndefined();
  });
});

describe("kewenangan", () => {
  it("belum masuk → diarahkan ke halaman masuk, tanpa mengubah apa pun", async () => {
    await expect(ganti(SANDI_BARU)).rejects.toMatchObject({ digest: expect.stringContaining("/masuk") });
  });

  it("akun nonaktif → diarahkan ke halaman masuk; kata sandinya tidak berubah", async () => {
    const operator = await operatorMasuk();
    await db.update(user).set({ banned: true }).where(eq(user.id, operator.id));
    await expect(ganti(SANDI_BARU)).rejects.toMatchObject({ digest: expect.stringContaining("/masuk") });
    await db.update(user).set({ banned: false }).where(eq(user.id, operator.id));
    await expect(masukUji(operator.email, sandiUji)).resolves.toContain("session_token");
  });
});

describe("kata sandi tidak ditulis ke log", () => {
  it("berhasil maupun ditolak", async () => {
    const tertulis: unknown[] = [];
    const metode = ["log", "info", "warn", "error", "debug", "trace"] as const;
    const pengintai = metode.map((m) => vi.spyOn(console, m).mockImplementation((...arg: unknown[]) => tertulis.push(...arg)));
    try {
      await operatorMasuk();
      await ganti("Sandi-Log-Pertama", "Sandi-Log-Pertama", "Sandi-Log-Salah");
      await ganti("Sandi-Log-Kedua", "Sandi-Log-Berbeda");
      await ganti("Sandi-Log-Ketiga");
    } finally {
      for (const p of pengintai) p.mockRestore();
    }
    expect(tertulis.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg) ?? String(arg))).join("\n")).not.toContain(
      "Sandi-Log",
    );
  });
});
