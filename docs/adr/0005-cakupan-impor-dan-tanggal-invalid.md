# Impor hanya sheet "(S)"; kolom tanggal invalid berisi data menahan publikasi

Status: accepted (2026-10-08) — keputusan pemilik

Tahap ini hanya mengimpor sheet penjualan berpola `<BULAN> (S)` yang sel A1-nya berisi `SALES`. Sheet `MP …` ditampilkan sebagai "di luar cakupan saat ini" dan tidak bisa dipilih. Sheet BARDAT ditolak. Hubungan sheet MP dengan toko atau gudang belum diputuskan, dan tidak boleh disimpulkan dari kemiripan nama.

Kolom tanggal invalid (misalnya `31/6`) yang seluruh selnya kosong menghasilkan peringatan dan kolom itu dilewati. Kolom invalid yang berisi angka apa pun, **termasuk nol yang diketik**, menghasilkan error per sel dan menahan publikasi. Isinya tidak pernah dipindahkan ke tanggal lain. Catatan dan formula di workbook tidak mengubah aturan ini.

Header tanggal dibaca sebagai nilai mentah. Nomor seri Excel dikonversi langsung ke tanggal kalender tanpa objek `Date` dan tanpa zona waktu.
