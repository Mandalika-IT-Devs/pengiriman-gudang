import { notFound } from "next/navigation";

import { wajibMasuk, type PenggunaMasuk } from "@/server/auth/kewenangan";
import { daftarGudangDapatDilihat } from "@/server/gudang/akses";
import { bacaRincianRencanaFinal, gudangRencanaFinal } from "@/server/gudang/rencana-final";

// Pemuat halaman Riwayat (T127, T136). Riwayat mengikuti penugasan (PRD A7 ▶ Revisi 2026-10-20, menggantikan "semua
// pengguna melihat semua gudang" pada ▶ Keputusan 2026-10-14): cakupan lihatnya sama dengan akses lihat Pengiriman
// Gudang (`daftarGudangDapatDilihat`). Admin melihat semua gudang termasuk nonaktif; pengguna lain hanya gudang aktif
// tempat ia punya penugasan apa pun. Akses ini hanya untuk melihat riwayat; halaman kerja gudang tetap memakai
// `wajibAksesLihatGudang`. Ekspor per rencana tetap butuh hak tindakan `ekspor` di gudang rencana itu (PRD A7 ▶
// Keputusan 2026-10-09), dihitung dengan aturan yang sama dengan route ekspor (gudang nonaktif tidak memberi hak).

const ID_VALID = /^\d{1,9}$/;

/**
 * Cakupan lihat Riwayat (T136; PRD A7 ▶ Revisi 2026-10-20): id gudang yang riwayatnya boleh dilihat `pengguna`, sama
 * dengan gudang yang boleh ia lihat di Pengiriman Gudang. Admin: semua gudang, termasuk nonaktif. Pengguna lain: gudang
 * aktif tempat ia punya penugasan, termasuk penugasan tanpa hak tindakan. Kosong = tidak boleh membuka Riwayat (viewer).
 * Dipakai halaman, rincian, pilihan filter, dan route ekspor.
 */
export async function cakupanLihatRiwayat(pengguna: PenggunaMasuk): Promise<number[]> {
  return (await daftarGudangDapatDilihat(pengguna)).map((g) => g.id);
}

/**
 * Seperti `wajibMasuk`, lalu 404 bagi pengguna bukan admin tanpa gudang dalam cakupan lihat Riwayat (viewer), seperti
 * viewer di Pengiriman Gudang (PRD A7 ▶ Revisi 2026-10-20).
 */
export async function wajibAksesRiwayat(): Promise<{ pengguna: PenggunaMasuk; cakupanGudang: number[] }> {
  const pengguna = await wajibMasuk();
  const cakupanGudang = await cakupanLihatRiwayat(pengguna);
  if (pengguna.peran !== "admin" && cakupanGudang.length === 0) notFound();
  return { pengguna, cakupanGudang };
}

/** Id gudang tempat `pengguna` punya hak tindakan `ekspor`. */
export async function gudangBolehEkspor(pengguna: PenggunaMasuk): Promise<ReadonlySet<number>> {
  const daftar = await daftarGudangDapatDilihat(pengguna);
  return new Set(daftar.filter((g) => g.hakTindakan.includes("ekspor")).map((g) => g.id));
}

/** Gudang yang barisnya ikut diekspor dari halaman Riwayat; lihat `cakupanEksporRiwayat`. */
export type CakupanEksporRiwayat = { semuaGudang: true } | { semuaGudang: false; gudang: ReadonlySet<number> };

/**
 * Cakupan ekspor halaman Riwayat (T129, PRD A7 ▶ Keputusan 2026-10-14): admin semua gudang tanpa penugasan (ekspor ini
 * hanya membaca catatan); pengguna lain hanya gudang tempat ia punya hak `ekspor` (gudang nonaktif tidak memberi hak).
 * `null` = tidak boleh mengekspor sama sekali (viewer, operator tanpa hak `ekspor` di gudang mana pun).
 */
export async function cakupanEksporRiwayat(pengguna: PenggunaMasuk): Promise<CakupanEksporRiwayat | null> {
  if (pengguna.peran === "admin") return { semuaGudang: true };
  const gudang = await gudangBolehEkspor(pengguna);
  return gudang.size === 0 ? null : { semuaGudang: false, gudang };
}

/** `true` bila baris gudang `idGudang` ikut diekspor dengan `cakupan`. */
export function ikutDiekspor(cakupan: CakupanEksporRiwayat, idGudang: number): boolean {
  return cakupan.semuaGudang || cakupan.gudang.has(idGudang);
}

/**
 * Nama gudang (urut `pilihanGudang`) yang punya baris di hasil filter (`idGudangHasil`) tetapi tidak ikut diekspor
 * dengan `cakupan`, untuk pemberitahuan sebelum ekspor dan baris keterangan berkas.
 */
export function gudangTidakIkutDiekspor(
  cakupan: CakupanEksporRiwayat,
  idGudangHasil: Iterable<number>,
  pilihanGudang: readonly { id: number; nama: string }[],
): string[] {
  const diHasil = new Set(idGudangHasil);
  return pilihanGudang.filter((g) => diHasil.has(g.id) && !ikutDiekspor(cakupan, g.id)).map((g) => g.nama);
}

/**
 * Rincian rencana final `idRencana` dari snapshot, beserta status aktif gudangnya sekarang; 404 bila tidak ada atau
 * gudangnya di luar `cakupanGudang` (T136, PRD A7 ▶ Revisi 2026-10-20).
 */
export async function muatRincianRencanaFinal(idRencana: string, cakupanGudang: readonly number[]) {
  if (!ID_VALID.test(idRencana)) notFound();
  const gudang = await gudangRencanaFinal(Number(idRencana));
  if (gudang === null || !cakupanGudang.includes(gudang.id)) notFound();
  const rencana = await bacaRincianRencanaFinal(gudang.id, Number(idRencana));
  if (rencana === null) notFound();
  return { gudangAktif: gudang.aktif, rencana };
}
