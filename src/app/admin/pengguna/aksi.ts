"use server";

import { APIError } from "better-auth/api";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import type { HasilSimpan } from "@/components/keadaan-simpan";
import { auth, daftarPeran } from "@/server/auth/auth";
import { bacaKataSandi, catatKataSandi, hapusSalinanLaluUbah } from "@/server/auth/catatan-kata-sandi";
import { wajibAdmin } from "@/server/auth/kewenangan";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

const PATH_HALAMAN = "/admin/pengguna";

const pesanGalatAuth: Record<string, string> = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Email sudah dipakai pengguna lain.",
  INVALID_EMAIL: "Email tidak valid.",
  PASSWORD_TOO_SHORT: "Kata sandi minimal 8 karakter.",
  PASSWORD_TOO_LONG: "Kata sandi terlalu panjang.",
  USER_NOT_FOUND: "Pengguna tidak ditemukan.",
  YOU_CANNOT_BAN_YOURSELF: "Akun sendiri tidak bisa dinonaktifkan.",
};

const PESAN_ATUR_ULANG_SENDIRI = "Kata sandi akun sendiri tidak bisa diatur ulang di sini.";

const peran = z.enum(daftarPeran, { error: "Pilih peran: admin atau viewer." });
const idPengguna = z.string().min(1, "Pengguna tidak ditemukan.");

// Sama dengan batas bawaan Better Auth (minPasswordLength 8, maxPasswordLength 128), agar pesannya berbahasa Indonesia.
const kataSandi = z.string().min(8, "Kata sandi minimal 8 karakter.").max(128, "Kata sandi terlalu panjang.");

const skemaBuat = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi."),
  email: z.string().trim().pipe(z.email("Email tidak valid.")),
  sandi: kataSandi,
  peran,
});
const skemaUbahPeran = z.object({ idPengguna, peran });
const skemaNonaktifkan = z.object({ idPengguna });
const skemaAktifkanKembali = z.object({ idPengguna });
const skemaTampilkanKataSandi = z.object({ idPengguna });
const skemaAturUlangKataSandi = z
  .object({ idPengguna, sandiBaru: kataSandi, ulangiSandiBaru: z.string() })
  .refine((isian) => isian.sandiBaru === isian.ulangiSandiBaru, { error: "Ulangan kata sandi baru tidak sama." });

/** Hasil "Tampilkan" kata sandi (T137). Kata sandi hanya dikirim di sini, saat diminta. */
export type HasilTampilkanKataSandi =
  | { keadaan: "tersedia"; sandi: string }
  | { keadaan: "belumTersedia" }
  | { keadaan: "gagal"; pesan: string };

function gagal(pesan: string): HasilSimpan {
  return { keadaan: "gagal", pesan };
}

// Kunci advisory PostgreSQL yang menyerialkan setiap perubahan yang bisa mengurangi jumlah admin aktif.
const KUNCI_ADMIN_AKTIF = 2_000_001;

/**
 * PRD A3: aplikasi selalu punya minimal satu admin aktif (peran admin dan tidak dinonaktifkan).
 * Jika `idTarget` adalah admin aktif terakhir, `tulis` tidak dijalankan dan hasilnya `false`.
 * Pemeriksaan dan penulisan berjalan di bawah satu kunci agar dua admin tidak saling menurunkan bersamaan.
 */
async function jagaAdminAktif(idTarget: string, tulis: () => Promise<unknown>): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${KUNCI_ADMIN_AKTIF})`);
    const adminAktif = await tx
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.role, "admin"), eq(user.banned, false)));
    const targetAdminAktif = adminAktif.some((admin) => admin.id === idTarget);
    if (targetAdminAktif && adminAktif.length <= 1) return false;
    await tulis();
    return true;
  });
}

/** Menjalankan tulis data; galat Better Auth menjadi pesan gagal, lalu tampilan dimuat ulang. */
async function simpan(tulis: () => Promise<unknown>): Promise<HasilSimpan> {
  try {
    await tulis();
  } catch (galat) {
    if (galat instanceof APIError) {
      const kode = typeof galat.body?.code === "string" ? galat.body.code : "";
      return gagal(pesanGalatAuth[kode] ?? "Perubahan tidak tersimpan.");
    }
    throw galat;
  }
  try {
    revalidatePath(PATH_HALAMAN);
  } catch {
    return { keadaan: "tersimpanGagalMuatUlang" };
  }
  return { keadaan: "berhasil" };
}

/** Seperti `simpan`, tetapi ditolak dengan `pesanTolak` jika menghabiskan admin aktif. */
async function simpanDijaga(idTarget: string, tulis: () => Promise<unknown>, pesanTolak: string) {
  let dijalankan = true;
  const hasil = await simpan(async () => {
    dijalankan = await jagaAdminAktif(idTarget, tulis);
  });
  return dijalankan ? hasil : gagal(pesanTolak);
}

export async function buatPengguna(input: unknown): Promise<HasilSimpan> {
  const admin = await wajibAdmin();
  const isian = skemaBuat.safeParse(input);
  if (!isian.success) return gagal(isian.error.issues[0].message);
  const { nama, email, sandi, peran } = isian.data;
  const kepala = await headers();
  // T137: setelah akun dibuat, kata sandinya dicatat (salinan hanya untuk akun bukan admin).
  return simpan(async () => {
    const { user: baru } = await auth.api.createUser({
      body: { name: nama, email, password: sandi, role: peran },
      headers: kepala,
    });
    await catatKataSandi({ idPengguna: baru.id, sandi, olehId: admin.id });
  });
}

export async function ubahPeran(input: unknown): Promise<HasilSimpan> {
  await wajibAdmin();
  const isian = skemaUbahPeran.safeParse(input);
  if (!isian.success) return gagal(isian.error.issues[0].message);
  const { idPengguna, peran } = isian.data;
  const kepala = await headers();
  const tulis = () => auth.api.setRole({ body: { userId: idPengguna, role: peran }, headers: kepala });
  // T137: akun admin tidak menyimpan salinan kata sandi; waktu dan pengisinya tetap.
  if (peran === "admin") return simpan(() => hapusSalinanLaluUbah(idPengguna, tulis));
  return simpanDijaga(idPengguna, tulis, "Peran tidak bisa diubah: aplikasi harus punya minimal satu admin aktif.");
}

/** Nonaktifkan = ban Better Auth tanpa batas waktu; semua sesi pengguna itu dicabut. */
export async function nonaktifkanPengguna(input: unknown): Promise<HasilSimpan> {
  const admin = await wajibAdmin();
  const isian = skemaNonaktifkan.safeParse(input);
  if (!isian.success) return gagal(isian.error.issues[0].message);
  const { idPengguna } = isian.data;
  if (idPengguna === admin.id) return gagal(pesanGalatAuth.YOU_CANNOT_BAN_YOURSELF);
  const kepala = await headers();
  return simpanDijaga(
    idPengguna,
    () => auth.api.banUser({ body: { userId: idPengguna }, headers: kepala }),
    "Pengguna tidak bisa dinonaktifkan: aplikasi harus punya minimal satu admin aktif.",
  );
}

/** Aktifkan kembali = unban Better Auth (T23). Peran tidak diubah; pengguna yang sudah aktif ditolak. */
export async function aktifkanKembaliPengguna(input: unknown): Promise<HasilSimpan> {
  await wajibAdmin();
  const isian = skemaAktifkanKembali.safeParse(input);
  if (!isian.success) return gagal(isian.error.issues[0].message);
  const { idPengguna } = isian.data;
  const [target] = await db.select({ banned: user.banned }).from(user).where(eq(user.id, idPengguna));
  if (!target) return gagal(pesanGalatAuth.USER_NOT_FOUND);
  if (target.banned !== true) return gagal("Pengguna ini sudah aktif.");
  const kepala = await headers();
  return simpan(() => auth.api.unbanUser({ body: { userId: idPengguna }, headers: kepala }));
}

/** Kata sandi terbaru satu akun bukan admin, saat admin menekan "Tampilkan" (T137, PRD A3 ▶ Keputusan 2026-10-20). */
export async function tampilkanKataSandi(input: unknown): Promise<HasilTampilkanKataSandi> {
  await wajibAdmin();
  const isian = skemaTampilkanKataSandi.safeParse(input);
  if (!isian.success) return { keadaan: "gagal", pesan: isian.error.issues[0].message };
  const { idPengguna } = isian.data;
  const [target] = await db.select({ role: user.role }).from(user).where(eq(user.id, idPengguna));
  if (!target) return { keadaan: "gagal", pesan: pesanGalatAuth.USER_NOT_FOUND };
  if (target.role === "admin") return { keadaan: "gagal", pesan: "Kata sandi akun admin tidak ditampilkan." };
  const sandi = await bacaKataSandi(idPengguna);
  return sandi === null ? { keadaan: "belumTersedia" } : { keadaan: "tersedia", sandi };
}

/**
 * Atur ulang kata sandi akun lain (T137, CONTEXT "Atur ulang kata sandi"): hash diganti lewat Better Auth, semua sesi akun
 * itu diakhiri, lalu kata sandinya dicatat (salinan hanya untuk akun bukan admin). Akun sendiri ditolak.
 */
export async function aturUlangKataSandi(input: unknown): Promise<HasilSimpan> {
  const admin = await wajibAdmin();
  const isian = skemaAturUlangKataSandi.safeParse(input);
  if (!isian.success) return gagal(isian.error.issues[0].message);
  const { idPengguna, sandiBaru } = isian.data;
  if (idPengguna === admin.id) return gagal(PESAN_ATUR_ULANG_SENDIRI);
  const kepala = await headers();
  return simpan(() =>
    catatKataSandi({
      idPengguna,
      sandi: sandiBaru,
      olehId: admin.id,
      gantiHash: async () => {
        await auth.api.setUserPassword({ body: { userId: idPengguna, newPassword: sandiBaru }, headers: kepala });
        await auth.api.revokeUserSessions({ body: { userId: idPengguna }, headers: kepala });
      },
    }),
  );
}
