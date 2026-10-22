import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { dekripsiSalinan, enkripsiSalinan } from "@/server/auth/salinan-kata-sandi";
import { db } from "@/server/db";
import { account, catatanKataSandi, user } from "@/server/db/schema";

// T137 (PRD A3 ▶ Keputusan 2026-10-20): catatan kata sandi terakhir setiap akun.
// - Salinan hanya untuk akun bukan admin; akun admin hanya dicatat waktu dan pengisinya.
// - Salinan diikat ke hash kata sandi yang berlaku (lihat `salinan-kata-sandi.ts`). Jika hash berganti tanpa salinan
//   baru tertulis (mis. penulisan salinan gagal), salinan lama tidak terbaca lagi dan tampil "Belum tersedia". Salinan
//   yang tampil tidak pernah berbeda dari kata sandi yang berlaku.
// - Setiap perubahan dijalankan berurutan per akun (kunci advisory), agar dua perubahan bersamaan tidak saling mengikat
//   salinan ke hash milik perubahan lain.
// - Kata sandi tidak pernah ditulis ke log.

// Kunci advisory dua bagian (kunci ini, hashtext(id akun)); ruangnya terpisah dari kunci satu bagian lain di aplikasi.
const KUNCI_KATA_SANDI = 2_000_002;

type Transaksi = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Menjalankan `kerja` dalam transaksi yang memegang kunci kata sandi akun `idPengguna`. */
function denganKunciAkun<T>(idPengguna: string, kerja: (tx: Transaksi) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${KUNCI_KATA_SANDI}, hashtext(${idPengguna}))`);
    return kerja(tx);
  });
}

/** Ikatan salinan: akun dan hash kata sandi yang berlaku. */
function ikatan(idPengguna: string, hash: string) {
  return `${idPengguna}\n${hash}`;
}

/** Peran dan hash kata sandi (akun credential Better Auth) yang berlaku saat ini. */
async function akunBerlaku(tx: Transaksi, idPengguna: string) {
  const [baris] = await tx
    .select({ peran: user.role, hash: account.password })
    .from(user)
    .leftJoin(account, and(eq(account.userId, user.id), eq(account.providerId, "credential")))
    .where(eq(user.id, idPengguna));
  return baris;
}

/**
 * Mencatat `sandi` sebagai kata sandi terakhir akun `idPengguna`, diisi oleh `olehId`. `gantiHash` (mis. atur ulang lewat
 * Better Auth) dijalankan lebih dulu, di bawah kunci akun yang sama. Salinan hanya disimpan untuk akun bukan admin.
 */
export async function catatKataSandi({
  idPengguna,
  sandi,
  olehId,
  gantiHash,
}: {
  idPengguna: string;
  sandi: string;
  olehId: string;
  gantiHash?: () => Promise<unknown>;
}): Promise<void> {
  await denganKunciAkun(idPengguna, async (tx) => {
    await gantiHash?.();
    const akun = await akunBerlaku(tx, idPengguna);
    if (!akun) throw new Error("Akun untuk catatan kata sandi tidak ditemukan.");
    const salinanTerenkripsi = akun.peran !== "admin" && akun.hash ? enkripsiSalinan(sandi, ikatan(idPengguna, akun.hash)) : null;
    await tx
      .insert(catatanKataSandi)
      .values({ userId: idPengguna, salinanTerenkripsi, diisiOleh: olehId })
      .onConflictDoUpdate({
        target: catatanKataSandi.userId,
        set: { salinanTerenkripsi, diisiOleh: olehId, diisiPada: sql`now()` },
      });
  });
}

/**
 * Menghapus salinan kata sandi akun `idPengguna` (waktu dan pengisi tetap), lalu menjalankan `ubah` (mis. menjadikan akun
 * itu admin), di bawah kunci akun yang sama. Penghapusan langsung tersimpan sebelum `ubah`: jika `ubah` gagal, akun bukan
 * admin hanya kehilangan salinannya ("Belum tersedia"); akun admin tidak pernah punya salinan.
 */
export async function hapusSalinanLaluUbah(idPengguna: string, ubah: () => Promise<unknown>): Promise<void> {
  await denganKunciAkun(idPengguna, async () => {
    await db.update(catatanKataSandi).set({ salinanTerenkripsi: null }).where(eq(catatanKataSandi.userId, idPengguna));
    await ubah();
  });
}

type BarisSalinan = { idPengguna: string; salinan: string | null; peran: string | null; hash: string | null };

/** Kata sandi dari salinan akun bukan admin yang masih terikat ke hash yang berlaku, atau `null`. */
function salinanTerbaca({ idPengguna, salinan, peran, hash }: BarisSalinan): string | null {
  if (peran === "admin" || !salinan || !hash) return null;
  return dekripsiSalinan(salinan, ikatan(idPengguna, hash));
}

const kolomSalinan = {
  idPengguna: catatanKataSandi.userId,
  salinan: catatanKataSandi.salinanTerenkripsi,
  peran: user.role,
  hash: account.password,
};

/** Kata sandi terbaru akun bukan admin, atau `null` jika belum tersedia (tanpa salinan, akun admin, tidak terbaca). */
export async function bacaKataSandi(idPengguna: string): Promise<string | null> {
  const [baris] = await db
    .select(kolomSalinan)
    .from(catatanKataSandi)
    .innerJoin(user, eq(user.id, catatanKataSandi.userId))
    .leftJoin(account, and(eq(account.userId, user.id), eq(account.providerId, "credential")))
    .where(eq(catatanKataSandi.userId, idPengguna));
  return baris ? salinanTerbaca(baris) : null;
}

/** Status kata sandi satu akun untuk halaman Pengguna. Kata sandinya sendiri tidak ikut. */
type StatusKataSandi = {
  /** Salinan akun bukan admin ada dan masih sesuai kata sandi yang berlaku. */
  tersedia: boolean;
  diubah: { pada: Date; oleh: string };
};

/** Status kata sandi setiap akun yang punya catatan; akun tanpa catatan (kata sandi sebelum fitur ini) tidak ada. */
export async function daftarStatusKataSandi(): Promise<Map<string, StatusKataSandi>> {
  const pengisi = alias(user, "pengisi");
  const baris = await db
    .select({ ...kolomSalinan, pada: catatanKataSandi.diisiPada, oleh: pengisi.name })
    .from(catatanKataSandi)
    .innerJoin(user, eq(user.id, catatanKataSandi.userId))
    .innerJoin(pengisi, eq(pengisi.id, catatanKataSandi.diisiOleh))
    .leftJoin(account, and(eq(account.userId, user.id), eq(account.providerId, "credential")));
  return new Map(baris.map((b) => [b.idPengguna, { tersedia: salinanTerbaca(b) !== null, diubah: { pada: b.pada, oleh: b.oleh } }]));
}
