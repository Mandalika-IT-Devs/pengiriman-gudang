// Klasifikasi produk manual / otomatis (PRD A6 ▶ Keputusan 2026-11-04; ADR-0012, menggantikan ADR-0007).

import { normalisasiAlias } from "./keluarga-aroma";

/** Alasan produk manual, dalam urutan pemeriksaan (ADR-0012). */
export type AlasanManual = "display-tester" | "kertas-tester" | "display";

type HasilKlasifikasi = { klasifikasi: "manual"; alasan: AlasanManual } | { klasifikasi: "otomatis" };

const KATEGORI_KERTAS_TESTER: readonly string[] = ["KTP", "KTL"];
const KATEGORI_DISPLAY: readonly string[] = ["DISPLAY PRIA", "DISPLAY WANITA"];

/**
 * Produk manual, diperiksa berurutan:
 * 1. display tester: kode berakhiran `-T`, apa pun kategorinya;
 * 2. kertas tester: kategori `KTP`/`KTL`, dicocokkan persis tanpa normalisasi;
 * 3. display: kategori `DISPLAY PRIA`/`DISPLAY WANITA` setelah normalisasi (trim, spasi ganda jadi satu, huruf besar;
 *    sama dengan alias nama stok), apa pun kodenya.
 * Selain itu otomatis.
 */
export function klasifikasiProduk(kode: string, kategori: string): HasilKlasifikasi {
  if (kode.endsWith("-T")) {
    return { klasifikasi: "manual", alasan: "display-tester" };
  }
  if (KATEGORI_KERTAS_TESTER.includes(kategori)) {
    return { klasifikasi: "manual", alasan: "kertas-tester" };
  }
  if (KATEGORI_DISPLAY.includes(normalisasiAlias(kategori))) {
    return { klasifikasi: "manual", alasan: "display" };
  }
  return { klasifikasi: "otomatis" };
}
