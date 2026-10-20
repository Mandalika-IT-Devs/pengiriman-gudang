import { cocokCari, teksParameter, type ParameterUrl } from "@/components/daftar-berhalaman";
import { parseTanggalBisnis } from "@/domain/kalender";
import { daftarRiwayatPengirimanDiLuarJadwal, pilihanFilterPengirimanDiLuarJadwal } from "@/server/gudang/pengiriman-di-luar-jadwal";
import { daftarRencanaFinal, pilihanFilterRencanaFinal } from "@/server/gudang/rencana-final";

import { nilaiFilter, nilaiTanggal, SEMUA } from "./filter";

// Hasil filter halaman Riwayat (T127, T128), dipakai tab di halaman dan route ekspor (T129) supaya ekspor berisi persis
// seluruh hasil filter yang diterapkan (termasuk cari), bukan hanya 50 baris halaman yang dibuka. Semuanya dibatasi
// cakupan lihat pengguna (`cakupanLihatRiwayat`, T136; PRD A7 ▶ Revisi 2026-10-20): baris, pilihan filter Gudang dan
// Toko, serta keadaan kosong. `?gudang=<id>` di luar cakupan berarti "Semua gudang", sama seperti nilai tidak dikenal.
// Kewenangan diperiksa pemanggil.

type PilihanFilter = { gudang: { id: number; nama: string; aktif: boolean }[]; toko: { id: number; nama: string }[] };

/** Filter yang diterapkan, dibaca dari URL: `SEMUA`/kosong = tanpa filter. */
export type TerapanRiwayat = { gudang: string; toko: string; dari: string; sampai: string; cari: string };

function bacaTerapan(parameter: ParameterUrl, pilihan: PilihanFilter): TerapanRiwayat {
  return {
    gudang: nilaiFilter(
      parameter.gudang,
      pilihan.gudang.map((g) => String(g.id)),
    ),
    toko: nilaiFilter(
      parameter.toko,
      pilihan.toko.map((t) => String(t.id)),
    ),
    dari: nilaiTanggal(parameter.dari),
    sampai: nilaiTanggal(parameter.sampai),
    cari: teksParameter(parameter.cari),
  };
}

function filterKueri(terapan: TerapanRiwayat) {
  return {
    idGudang: terapan.gudang === SEMUA ? undefined : Number(terapan.gudang),
    tokoId: terapan.toko === SEMUA ? undefined : Number(terapan.toko),
    dari: terapan.dari === "" ? undefined : parseTanggalBisnis(terapan.dari),
    sampai: terapan.sampai === "" ? undefined : parseTanggalBisnis(terapan.sampai),
  };
}

/** Parameter URL filter yang diterapkan (tanpa halaman), untuk tautan halaman dan alamat ekspor. */
export function parameterTerapan(terapan: TerapanRiwayat, tab?: string): ParameterUrl {
  return {
    tab,
    gudang: terapan.gudang === SEMUA ? undefined : terapan.gudang,
    toko: terapan.toko === SEMUA ? undefined : terapan.toko,
    dari: terapan.dari,
    sampai: terapan.sampai,
    cari: terapan.cari,
  };
}

/**
 * Seluruh rencana final gudang dalam `cakupanGudang` yang cocok dengan filter di URL; `null` bila belum ada rencana
 * final sama sekali di cakupan itu.
 */
export async function hasilFilterRencanaFinal(parameter: ParameterUrl, cakupanGudang: readonly number[]) {
  const pilihan = await pilihanFilterRencanaFinal(cakupanGudang);
  if (!pilihan.adaRencanaFinal) return null;
  const terapan = bacaTerapan(parameter, pilihan);
  const semua = await daftarRencanaFinal({ cakupanGudang, ...filterKueri(terapan) });
  return { pilihan, terapan, hasil: semua.filter((r) => cocokCari(terapan.cari, r.toko.nama)) };
}

/**
 * Seluruh pengiriman di luar jadwal gudang dalam `cakupanGudang` yang cocok dengan filter di URL; `null` bila belum ada
 * pengiriman sama sekali di cakupan itu.
 */
export async function hasilFilterDiLuarJadwal(parameter: ParameterUrl, cakupanGudang: readonly number[]) {
  const pilihan = await pilihanFilterPengirimanDiLuarJadwal(cakupanGudang);
  if (!pilihan.adaPengiriman) return null;
  const terapan = bacaTerapan(parameter, pilihan);
  const semua = await daftarRiwayatPengirimanDiLuarJadwal({ cakupanGudang, ...filterKueri(terapan) });
  return { pilihan, terapan, hasil: semua.filter((e) => cocokCari(terapan.cari, e.toko)) };
}
