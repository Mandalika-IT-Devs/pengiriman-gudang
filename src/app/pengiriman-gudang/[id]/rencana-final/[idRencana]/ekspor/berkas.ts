import * as XLSX from "xlsx";

import { formatWaktu } from "@/app/admin/impor/format";
import { formatTanggal } from "@/domain/kalender";
import type { RencanaFinal } from "@/server/gudang/rencana-final";

import { teksJenisPengiriman } from "../../../teks-di-luar-jadwal";
import { labelStatusBarisRencanaFinal } from "../../label-status-baris";

// Berkas ekspor rencana final (T64; PRD A7 ▶ Keputusan 2026-10-09: .xlsx), format packing list (T133; PRD A7 ▶ Keputusan
// 2026-10-18): kepala gudang, tanggal kirim, toko, jenis pengiriman (rutin atau di luar jadwal, T114), dan waktu
// finalisasi dari snapshot finalisasi, lalu tabel produk dengan kolom Keterangan kosong untuk catatan gudang. Identitas
// sumber penjualan, ranking, dan keterangan arti "—" tidak ditulis; penelusurannya di rincian rencana final. Status
// memakai label yang sama seperti layar rincian (T77). Nilai kosong/tidak tersedia ditulis "—", bukan 0 (DESIGN §7, §8).

export const TIDAK_TERSEDIA = "—";

/** Baris "Keterangan" arti tanda tidak tersedia di ekspor halaman Riwayat (T129). */
export const KETERANGAN_TIDAK_TERSEDIA = `${TIDAK_TERSEDIA} = tidak tersedia atau belum diisi, bukan 0.`;

/** `null` = sel kosong. */
export type Sel = string | number | null;

type KolomProduk = "Kode produk" | "Nama produk" | "Kebutuhan barang" | "Stok akhir" | "Buffer (%)" | "Jumlah kirim" | "Status";

type BarisProduk = Pick<
  RencanaFinal["baris"][number],
  "kodeProduk" | "namaProduk" | "kebutuhan" | "stokAkhir" | "persenBuffer" | "jumlahKirim" | "status"
>;

const angkaAtauTidakTersedia = (nilai: number | null): Sel => nilai ?? TIDAK_TERSEDIA;

/** Isi sel produk per judul kolom; satu sumber untuk ekspor rencana final dan ekspor halaman Riwayat. */
function nilaiProduk(b: BarisProduk): Record<KolomProduk, Sel> {
  return {
    "Kode produk": b.kodeProduk,
    "Nama produk": b.namaProduk ?? TIDAK_TERSEDIA,
    "Kebutuhan barang": angkaAtauTidakTersedia(b.kebutuhan),
    "Stok akhir": angkaAtauTidakTersedia(b.stokAkhir),
    "Buffer (%)": angkaAtauTidakTersedia(b.persenBuffer),
    "Jumlah kirim": angkaAtauTidakTersedia(b.jumlahKirim),
    Status: labelStatusBarisRencanaFinal[b.status],
  };
}

/** Kolom tabel produk ekspor halaman Riwayat (T129; PRD A7 ▶ Keputusan 2026-10-14, tidak berubah oleh T133). */
export const KOLOM_PRODUK_EKSPOR: readonly KolomProduk[] = [
  "Kode produk",
  "Nama produk",
  "Kebutuhan barang",
  "Stok akhir",
  "Buffer (%)",
  "Jumlah kirim",
  "Status",
];

/** Sel tabel produk satu baris rencana final, urut `KOLOM_PRODUK_EKSPOR` (ekspor halaman Riwayat). */
export function selProdukEkspor(b: BarisProduk): Sel[] {
  const nilai = nilaiProduk(b);
  return KOLOM_PRODUK_EKSPOR.map((k) => nilai[k]);
}

/** Kolom tabel berkas rencana final (baris 8): Status sebelum Jumlah kirim, lalu Keterangan yang selalu kosong. */
const KOLOM_BERKAS: readonly (KolomProduk | "Keterangan")[] = [
  "Kode produk",
  "Nama produk",
  "Kebutuhan barang",
  "Stok akhir",
  "Buffer (%)",
  "Status",
  "Jumlah kirim",
  "Keterangan",
];

/** Lebar kolom A–H dalam karakter, mengikuti contoh file pemilik. */
const LEBAR_KOLOM_BERKAS = [17, 57, 18, 10, 10, 12, 12, 14];

function selBerkas(b: BarisProduk): Sel[] {
  const nilai = nilaiProduk(b);
  return KOLOM_BERKAS.map((k) => (k === "Keterangan" ? null : nilai[k]));
}

/** Nama berkas, mis. `rencana-final-PMS-2026-06-08-v1.xlsx`; karakter selain huruf, angka, dan "-" dibuang dari nama toko. */
export function namaBerkasEkspor(rencana: Pick<RencanaFinal, "toko" | "tanggalKirim" | "versi">) {
  const toko = rencana.toko.nama.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `toko-${rencana.toko.id}`;
  return `rencana-final-${toko}-${rencana.tanggalKirim}-v${rencana.versi}.xlsx`;
}

/**
 * Workbook `.xlsx` berisi satu sheet "Rencana final": baris 1 judul, baris 2–6 label (kolom A) dan nilai (kolom B),
 * baris 7 kosong, baris 8 judul kolom, baris produk mulai baris 9 (urut `rencana.baris`).
 */
export function buatBerkasEkspor(rencana: RencanaFinal): Buffer {
  const kepala: Sel[][] = [
    ["Rencana final"],
    ["Gudang", rencana.gudang.nama],
    ["Tanggal kirim", formatTanggal(rencana.tanggalKirim)],
    ["Toko", rencana.toko.nama],
    ["Jenis pengiriman", teksJenisPengiriman(rencana.diLuarJadwal)],
    ["Waktu finalisasi", formatWaktu(rencana.difinalisasiPada)],
    [],
  ];
  const sheet = XLSX.utils.aoa_to_sheet([...kepala, [...KOLOM_BERKAS], ...rencana.baris.map(selBerkas)]);
  sheet["!cols"] = LEBAR_KOLOM_BERKAS.map((wch) => ({ wch }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Rencana final");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
