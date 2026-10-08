# [T10] Pembaca dan validator sheet penjualan
<!-- labels: ready-for-agent,M1,pelaksana:A -->

## Yang dibangun
Modul server (tanpa database) yang membaca satu sheet penjualan dari workbook dan menghasilkan hasil baca terstruktur, lengkap dengan daftar masalah. Setiap masalah punya lokasi `sheet!sel` dan cara memperbaikinya.

## Dalam scope
- Input: buffer workbook, nama sheet, tahun impor, bulan impor, dan daftar nama toko master.
- SheetJS dengan opsi `sheets` (hanya sheet terpilih) dan `cellDates: false`.
- Struktur: A1 `SALES`; baris 1 = nama toko per blok; baris 2 = header tanggal; baris 3 = judul kolom + total harian (diabaikan); baris 4+ = produk (NO, PRODUCT CODE, PRODUCT NAME, SIZE, PRODUCT CATEGORY).
- Header tanggal: DD/MM, DD/MM/YYYY, atau nomor seri Excel, mengikuti `tests/golden/tanggal-impor.json`.
- Output: blok toko, kolom tanggal (valid / invalid / di luar bulan impor), sel bernilai (termasuk nol yang diketik) dengan alamat sel, dan daftar masalah (error / peringatan).
- Validasi:
  - Error: sheet berawalan `MP ` ("di luar cakupan saat ini"); A1 bukan `SALES`; nama toko tidak ada di master; blok toko ganda; kode produk ganda; tanggal ganda dalam satu blok; tanggal di luar bulan impor; kuantitas bukan angka atau bukan bilangan bulat; kuantitas negatif ("menunggu keputusan OD-01"); kolom tanggal invalid yang berisi angka apa pun.
  - Peringatan: kolom tanggal invalid yang kosong (dilewati).

## Di luar scope
Penyimpanan ke database, unggah, worker, dan UI. Workbook asli tidak di-commit; test membuat workbook kecil sendiri.

## Kriteria penerimaan
- [ ] Semua kasus `tests/golden/tanggal-impor.json` lulus lewat test berbasis workbook kecil.
- [ ] Test: kolom `31/6` kosong → peringatan dan kolom dilewati; kolom `31/9` berisi 1 → error dengan alamat sel; sel berisi `0` → tersimpan sebagai pengamatan; sel kosong → tidak muncul sebagai sel bernilai.
- [ ] Bukti manual di PR: dijalankan lokal pada `JUNI (S)` dari workbook asli → 0 error, 25 peringatan kolom `31/6`, beserta waktu prosesnya.
- [ ] `pnpm verify` hijau. Dependency SheetJS disetujui pemilik (label `disetujui-pemilik`).

## Rujukan
PRD A1, B8; ADR-0002, ADR-0005; OD-01

## Blocked by
- [T00], [T02]

## Pelaksana
A (Claude Code)
