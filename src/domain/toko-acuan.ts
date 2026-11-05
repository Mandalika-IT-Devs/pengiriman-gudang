// Toko acuan pada jadwal tetap (PRD A5 ▶ Keputusan 2026-11-04; GLOSSARY "Toko acuan"): toko tanpa data penjualan meminjam
// varian dan rata-rata penjualan toko lain. Toko acuan harus toko lain yang aktif, dan tidak boleh berantai. Toko yang
// sedang menjadi toko acuan tidak bisa dinonaktifkan (T150). Draft memakai varian dan rata-rata toko acuan (T151).

export type MasukanValidasiTokoAcuan = {
  /** Nama toko yang jadwal tetapnya disimpan (nama toko unik). */
  toko: string;
  /** Toko acuan yang dipilih; `null` = tanpa toko acuan. `memakaiTokoAcuan` = jadwal tetap aktifnya memakai toko acuan. */
  tokoAcuan: { nama: string; aktif: boolean; memakaiTokoAcuan: boolean } | null;
  /** Nama toko lain yang jadwal tetap aktifnya memakai toko ini sebagai toko acuan, dalam urutan tampil. */
  dipakaiSebagaiAcuanOleh: readonly string[];
};

export type HasilValidasiTokoAcuan = { hasil: "sah" } | { hasil: "ditolak"; pesan: string };

/**
 * Memeriksa toko acuan saat jadwal tetap disimpan (PRD A5 ▶ Keputusan 2026-11-04, "Saat menyimpan"), dengan urutan
 * pemeriksaan seperti PRD. Tanpa toko acuan selalu sah.
 */
export function validasiTokoAcuan({ toko, tokoAcuan, dipakaiSebagaiAcuanOleh }: MasukanValidasiTokoAcuan): HasilValidasiTokoAcuan {
  if (tokoAcuan === null) return { hasil: "sah" };
  if (tokoAcuan.nama === toko) return { hasil: "ditolak", pesan: "Toko acuan tidak boleh toko ini sendiri." };
  if (!tokoAcuan.aktif) {
    return { hasil: "ditolak", pesan: `Toko ${tokoAcuan.nama} nonaktif, jadi tidak bisa menjadi toko acuan.` };
  }
  if (tokoAcuan.memakaiTokoAcuan) {
    return { hasil: "ditolak", pesan: `Toko ${tokoAcuan.nama} memakai toko acuan sendiri, jadi tidak bisa menjadi toko acuan.` };
  }
  if (dipakaiSebagaiAcuanOleh.length > 0) {
    return {
      hasil: "ditolak",
      pesan: `Toko ${toko} menjadi toko acuan untuk ${dipakaiSebagaiAcuanOleh.join(", ")}, jadi tidak bisa memakai toko acuan sendiri.`,
    };
  }
  return { hasil: "sah" };
}

export type MasukanNonaktifkanToko = {
  /** Nama toko yang akan dinonaktifkan. */
  toko: string;
  /** Nama toko lain yang jadwal tetap aktifnya memakai toko ini sebagai toko acuan, dalam urutan tampil. */
  dipakaiSebagaiAcuanOleh: readonly string[];
};

export type HasilNonaktifkanToko = { hasil: "boleh" } | { hasil: "ditolak"; pesan: string };

/**
 * Memeriksa apakah toko boleh dinonaktifkan (PRD A5 ▶ Keputusan 2026-11-04, "Menonaktifkan toko"): toko yang sedang
 * menjadi toko acuan di jadwal tetap aktif toko lain ditolak, supaya toko acuan selalu aktif.
 */
export function nonaktifkanToko({ toko, dipakaiSebagaiAcuanOleh }: MasukanNonaktifkanToko): HasilNonaktifkanToko {
  if (dipakaiSebagaiAcuanOleh.length === 0) return { hasil: "boleh" };
  return {
    hasil: "ditolak",
    pesan: `Toko ${toko} masih menjadi toko acuan untuk ${dipakaiSebagaiAcuanOleh.join(", ")}. Ganti atau hapus toko acuan itu di Jadwal toko dulu.`,
  };
}

export type MasukanSumberVarianDanRataRata<T> = {
  /** Toko yang dihitung di draft. */
  toko: T;
  /** Toko acuan jadwal tetap toko itu saat draft dihitung; `null` = tanpa toko acuan. */
  tokoAcuan: T | null;
  /** Toko itu sendiri punya sedikitnya satu baris di impor aktif periode sumber. */
  punyaDataSendiri: boolean;
};

export type HasilSumberVarianDanRataRata<T> = {
  /** Toko yang varian dan Rata-rata Ringkasannya dipakai draft. */
  sumber: T;
  /** Kepala toko menampilkan catatan "data penjualan sendiri" (tidak menahan finalisasi). */
  catatanDataSendiri: boolean;
};

/**
 * Sumber varian dan rata-rata draft satu toko (PRD A5 ▶ Keputusan 2026-11-04, Perhitungan): toko acuan bila jadwal tetap
 * toko itu memakainya, selain itu toko itu sendiri. Toko acuan tetap dipakai walaupun toko itu sudah punya data penjualan
 * sendiri; draft lalu menampilkan catatan (Tampilan).
 */
export function sumberVarianDanRataRata<T>({
  toko,
  tokoAcuan,
  punyaDataSendiri,
}: MasukanSumberVarianDanRataRata<T>): HasilSumberVarianDanRataRata<T> {
  if (tokoAcuan === null) return { sumber: toko, catatanDataSendiri: false };
  return { sumber: tokoAcuan, catatanDataSendiri: punyaDataSendiri };
}
