# Fixture golden

Folder ini berisi contoh hitungan yang benar, yang diturunkan dari PRD.

Folder ini hanya-baca. Agent tidak boleh mengubahnya, karena folder ini termasuk berkas terlindungi. Kalau sebuah test merah, yang diperbaiki adalah kodenya, bukan fixture di sini.

Setiap aturan PRD punya satu berkas JSON, misalnya `jumlah-kirim.json`. Isinya kasus-kasus dengan input, output yang diharapkan, dan rujukan ke PRD §.

## Golden yang digantikan

- `klasifikasi-produk.json` mencatat aturan ADR-0007 (sebelum 2026-11-04) dan tidak dibaca test lagi. Penggantinya `klasifikasi-produk-2026-11-04.json` (ADR-0012, produk display menjadi manual), dibaca test sejak T145.

## Golden yang belum dibaca test

Berkas yang ditambahkan bersama keputusan pemilik, sebelum kodenya ada, dicatat di sini sampai tiket yang mengimplementasikan aturannya menyambungkan berkas itu ke test.

- Tidak ada. `klasifikasi-produk-2026-11-04.json` dibaca test sejak T145, dan `toko-acuan.json` sejak T149–T151.

## Aturan yang belum punya golden

<!-- Catat di sini aturan PRD yang belum punya contoh hitungan. -->
