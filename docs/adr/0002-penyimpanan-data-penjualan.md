# Data penjualan disimpan sebagai sel terisi + cakupan tanggal; hasil laporan adalah cache

Status: accepted (2026-10-08)

Dari sheet penjualan, yang disimpan hanya **sel yang berisi angka** (termasuk nol yang diketik), lengkap dengan alamat selnya. Disimpan juga **cakupan tanggal**: daftar kolom tanggal valid per sheet dan per toko. Sel kosong pada tanggal valid adalah **nol tersirat** dan tidak disimpan sebagai baris. Tanggal yang tidak ada di cakupan berarti **tidak tersedia**. Dengan cara ini, nol dan "tidak tersedia" tetap terbedakan, setiap angka bisa ditelusuri sampai sel, dan ukuran data tetap kecil (±25 ribu baris per bulan).

Nilai mingguan, rata-rata bulanan, dan Ringkasan **tidak** disimpan sebagai data sumber. Ketiganya disimpan sebagai cache hasil hitung dengan kunci versi impor dan revisi kalender. Cache dihitung ulang di worker ketika impor diaktifkan atau kategori efektif berubah. Alasannya: kategori efektif bisa berubah per toko, satu kelompok Senin–Kamis bisa melintasi dua sheet, dan penelusuran sampai sel membutuhkan data harian.

Hanya ada **satu impor aktif per bulan impor**. Semua tanggal valid di sheet harus berada di bulan impor yang dipilih. Mengaktifkan impor baru untuk bulan yang sama menggantikan impor lama dalam satu transaksi. Impor lama tetap disimpan sebagai arsip. Impor yang gagal atau belum selesai tidak pernah menyentuh data aktif.
