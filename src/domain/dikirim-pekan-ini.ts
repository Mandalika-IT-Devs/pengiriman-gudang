// Dikirim pekan ini (PRD A5 ▶ Revisi 2026-10-19; GLOSSARY "Dikirim pekan ini", "Kirim terakhir"): nilai awal pilihan
// "Dikirim" / "Tidak dikirim pekan ini" toko dua mingguan pada satu tanggal kirim rutinnya, dari kirim terakhir toko itu.

import { selisihHari, type TanggalBisnis } from "./kalender";

/** Kirim terakhir sejauh ini atau lebih sebelum tanggal kirim → nilai awal "Dikirim" (dua minggu). */
const JARAK_HARI_DIKIRIM = 14;

export type NilaiAwalDikirimPekanIni = {
  /** `true` = Dikirim; `false` = Tidak dikirim pekan ini. */
  dikirim: boolean;
  /** Jumlah hari dari kirim terakhir sampai tanggal kirim; `null` = belum ada rencana final sebelumnya. */
  selisihHari: number | null;
};

/**
 * Nilai awal otomatis pilihan dikirim pekan ini pada `tanggalKirim` (PRD A5 ▶ Revisi 2026-10-19): Dikirim bila belum ada
 * kirim terakhir (`null`), atau kirim terakhirnya 14 hari atau lebih sebelum `tanggalKirim`; selain itu Tidak dikirim
 * pekan ini. Kirim terakhir harus sebelum `tanggalKirim`.
 */
export function nilaiAwalDikirimPekanIni(tanggalKirim: TanggalBisnis, kirimTerakhir: TanggalBisnis | null): NilaiAwalDikirimPekanIni {
  if (kirimTerakhir === null) return { dikirim: true, selisihHari: null };
  const selisih = selisihHari(kirimTerakhir, tanggalKirim);
  if (selisih <= 0) throw new RangeError(`Kirim terakhir ${kirimTerakhir} harus sebelum tanggal kirim ${tanggalKirim}.`);
  return { dikirim: selisih >= JARAK_HARI_DIKIRIM, selisihHari: selisih };
}
