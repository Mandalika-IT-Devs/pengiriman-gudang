import { and, asc, eq } from "drizzle-orm";

import type { Peran } from "@/server/auth/auth";
import { db } from "@/server/db";
import { gudang, penugasanOperator } from "@/server/db/schema";
import { daftarHakTindakan, type HakTindakan } from "@/server/gudang/hak-tindakan";

// Satu-satunya aturan siapa memegang hak tindakan di gudang mana (CODING_STANDARDS "Kewenangan"). Halaman, sidebar,
// route ekspor, dan pemeriksaan hak di server (`wajibHakTindakan`, `wajibGudangDenganHak`) membaca hak dari sini.

/**
 * Gudang yang boleh dilihat pengguna di halaman Pengiriman Gudang, beserta hak tindakannya di sana. `aktif = false`
 * hanya terlihat oleh admin (hanya-baca, T110).
 */
export type GudangDapatDilihat = { id: number; nama: string; aktif: boolean; hakTindakan: HakTindakan[] };

/**
 * Hak tindakan pengguna di satu gudang (PRD A3 ▶ Keputusan 2026-11-04): gudang nonaktif tidak memberi hak kepada siapa
 * pun (A3 ▶ Revisi 2026-10-13); di gudang aktif admin memegang kelima hak tindakan tanpa penugasan, dan penugasannya
 * tidak mengurangi hak itu; pengguna lain hanya memegang hak dari penugasannya (`null` = tidak ditugaskan).
 */
function hakTindakanDiGudang(peran: Peran, aktif: boolean, hakPenugasan: readonly HakTindakan[] | null): HakTindakan[] {
  if (!aktif) return [];
  if (peran === "admin") return [...daftarHakTindakan];
  return [...(hakPenugasan ?? [])];
}

/**
 * Akses lihat Pengiriman Gudang beserta hak tindakan di setiap gudang:
 * - pengguna bukan admin: penugasan apa pun di gudang aktif itu, termasuk penugasan tanpa hak tindakan (PRD A3
 *   ▶ Keputusan 2026-10-09). Penugasan ke gudang nonaktif tidak memberi akses maupun hak tindakan (A3 ▶ Revisi
 *   2026-10-13, T110);
 * - admin melihat semua gudang, dengan kelima hak tindakan di setiap gudang aktif tanpa penugasan, dan hanya-baca di
 *   gudang nonaktif (A3 ▶ Keputusan 2026-11-04).
 * Urut sesuai id gudang (urutan seed master).
 */
export async function daftarGudangDapatDilihat(pengguna: { id: string; peran: Peran }): Promise<GudangDapatDilihat[]> {
  const baris = await db
    .select({ id: gudang.id, nama: gudang.nama, aktif: gudang.aktif, hakTindakan: penugasanOperator.hakTindakan })
    .from(gudang)
    .leftJoin(penugasanOperator, and(eq(penugasanOperator.gudangId, gudang.id), eq(penugasanOperator.userId, pengguna.id)))
    .orderBy(asc(gudang.id));
  return baris
    .filter((b) => pengguna.peran === "admin" || (b.aktif && b.hakTindakan !== null))
    .map((b) => ({ id: b.id, nama: b.nama, aktif: b.aktif, hakTindakan: hakTindakanDiGudang(pengguna.peran, b.aktif, b.hakTindakan) }));
}

/**
 * Apakah pengguna memegang hak `tindakan` di gudang `idGudang`, dengan aturan `daftarGudangDapatDilihat`. Gudang yang tidak
 * ada atau nonaktif tidak memberi hak, juga untuk admin.
 */
export async function punyaHakTindakan(pengguna: { id: string; peran: Peran }, idGudang: number, tindakan: HakTindakan): Promise<boolean> {
  const gudangDilihat = (await daftarGudangDapatDilihat(pengguna)).find((g) => g.id === idGudang);
  return gudangDilihat?.hakTindakan.includes(tindakan) ?? false;
}

/**
 * Gudang tempat pengguna langsung masuk tanpa melewati daftar gudang (DESIGN §11.5, T118): operator (bukan admin) yang
 * hanya punya tepat satu gudang yang bisa dibuka. `null` = pengguna melihat daftar gudang. Admin selalu melihat daftar.
 */
export function gudangLangsungMasuk<G>(pengguna: { peran: Peran }, daftarGudang: readonly G[]): G | null {
  return pengguna.peran !== "admin" && daftarGudang.length === 1 ? daftarGudang[0] : null;
}
