# Fixture golden

Folder ini berisi contoh hitungan yang benar, yang diturunkan dari PRD.

Folder ini hanya-baca. Agent tidak boleh mengubahnya, karena folder ini termasuk berkas terlindungi. Kalau sebuah test merah, yang diperbaiki adalah kodenya, bukan fixture di sini.

Setiap aturan PRD punya satu berkas JSON, misalnya `jumlah-kirim.json`. Isinya kasus-kasus dengan input, output yang diharapkan, dan rujukan ke PRD §.

## Golden yang digantikan

- `klasifikasi-produk.json` mencatat aturan ADR-0007 (sebelum 2026-11-04). Penggantinya `klasifikasi-produk-2026-11-04.json` (ADR-0012, produk display menjadi manual). Test klasifikasi dipindah ke berkas pengganti oleh tiket yang mengimplementasikan aturan itu. Setelah itu berkas lama tidak dibaca test lagi.

## Golden yang belum dibaca test

Berkas di bawah ini ditambahkan bersama keputusan pemilik, sebelum kodenya ada. Tiket yang mengimplementasikan aturannya menyambungkan berkas itu ke test.

- `klasifikasi-produk-2026-11-04.json`: PRD A6 ▶ Keputusan 2026-11-04.
- `toko-acuan.json`: PRD A5 ▶ Keputusan 2026-11-04 (toko acuan).

## Aturan yang belum punya golden

<!-- Catat di sini aturan PRD yang belum punya contoh hitungan. -->
