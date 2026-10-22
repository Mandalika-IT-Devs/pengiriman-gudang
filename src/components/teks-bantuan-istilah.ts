// Teks bantuan singkat untuk istilah domain (DESIGN §11.6, T121). Istilahnya tetap istilah GLOSSARY.md; penjelasannya
// satu atau dua kalimat yang diturunkan dari definisi GLOSSARY.md dan PRD. Semua teks bantuan ditulis di berkas ini.

export const TEKS_BANTUAN_ISTILAH = {
  persiapan: {
    judul: "Persiapan (H, H−1, H−2)",
    penjelasan:
      "Hari barang disiapkan, dihitung dari tanggal kirim (H): H berarti pada hari kirim, H−1 sehari sebelumnya, dan H−2 dua hari sebelumnya. Hari persiapan ikut masuk cakupan.",
  },
  cakupan: {
    judul: "Cakupan",
    penjelasan:
      "Rentang tanggal yang kebutuhannya dihitung: dari hari persiapan sampai sehari sebelum kiriman berikutnya, kecuali toko dua mingguan selalu 14 hari sejak tanggal kirim. Kebutuhan barang adalah jumlah rata-rata sesuai kategori setiap tanggal di rentang ini.",
  },
  panjangCakupan: {
    judul: "Panjang cakupan",
    penjelasan:
      "Jumlah hari dari tanggal kirim sampai sehari sebelum tanggal kirim berikutnya toko ini, misalnya 7 hari untuk kiriman sekali seminggu. Toko dua mingguan selalu 14 hari, kapan pun kiriman berikutnya.",
  },
  dikirimPekanIni: {
    judul: "Dikirim pekan ini",
    penjelasan:
      "Pilihan untuk toko dua mingguan pada tanggal kirim rutinnya: nilai awalnya Dikirim jika kirim terakhir 14 hari atau lebih sebelumnya atau belum ada, dan operator yang berhak finalisasi boleh mengubahnya. Toko yang Tidak dikirim pekan ini tidak bisa difinalisasi dan tidak dihitung belum final.",
  },
  tanggalJangkar: {
    judul: "Tanggal jangkar",
    penjelasan:
      "Aturan lama sebelum 19-10-2026: tanggal yang menentukan pekan kirim pola dua mingguan, berulang setiap 14 hari. Sekarang toko dua mingguan bisa dikirim setiap pekan pada hari kirimnya dan operator memilih pekannya di draft.",
  },
  kategori: {
    judul: "Kategori dasar dan efektif",
    penjelasan:
      "Kategori dasar adalah kategori hari menurut tanggal sebenarnya: Senin–Kamis, Jumat, Sabtu, atau Minggu. Kategori efektif adalah yang dipakai untuk menghitung: perubahan khusus toko, lalu perubahan seluruh toko, lalu kategori dasar.",
  },
  klasifikasiProduk: {
    judul: "Produk otomatis dan manual",
    penjelasan:
      "Produk manual adalah display tester (kode berakhiran -T) dan kertas tester (kategori KTP/KTL), tanpa jumlah kirim dan tanpa buffer otomatis. Semua produk lain adalah produk otomatis.",
  },
  buffer: {
    judul: "Buffer",
    penjelasan:
      "Persen tambahan di atas seluruh kebutuhan barang: 20% untuk varian keluarga aroma tujuh besar ranking pusat, 10% untuk produk otomatis lainnya.",
  },
  hanyaBaca: {
    judul: "Hanya-baca",
    penjelasan:
      "Anda bisa melihat isi halaman ini, tetapi tidak bisa mengubah atau menjalankan tindakan. Hak tindakan diberikan admin lewat penugasan gudang.",
  },
  periodeSumber: {
    judul: "Periode sumber",
    penjelasan:
      "Bulan laporan yang dipakai gudang sebagai dasar rata-rata untuk menghitung kebutuhan. Ditetapkan admin per gudang dan terpisah dari pilihan bulan di Ringkasan.",
  },
  perluDihitungUlang: {
    judul: "Perlu dihitung ulang",
    penjelasan:
      "Stok akhir yang sudah diisi tetap disimpan saat draft dihitung ulang. Stok untuk toko atau varian yang tidak ada lagi di draft ditampilkan sebagai keterangan dan dipakai kembali jika toko atau varian itu muncul lagi.",
  },
  fileStok: {
    judul: "File stok",
    penjelasan:
      "Ekspor stok akhir kasir untuk toko ini: CSV (pemisah koma, titik koma, atau tab) atau Excel (.xlsx, sheet pertama), maksimal 1 MB, dengan judul kolom Name - Variant dan Ending.",
  },
  mingguLaporan: {
    judul: "Minggu dan bulan laporan",
    penjelasan:
      "Label di atas setiap baris kalender menunjukkan minggu dan bulan laporan; satu baris bisa memiliki dua label. Bulan dan minggu laporan tetap, walaupun kategori tanggal diubah admin.",
  },
} as const satisfies Record<string, { judul: string; penjelasan: string }>;

export type IstilahBantuan = keyof typeof TEKS_BANTUAN_ISTILAH;
