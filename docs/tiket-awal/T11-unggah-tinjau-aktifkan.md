# [T11] Unggah, tinjau, dan aktifkan impor penjualan
<!-- labels: ready-for-agent,M1,pelaksana:A -->

## Yang dibangun
Alur end-to-end untuk admin: unggah workbook → pilih sheet dan tahun/bulan impor → worker membaca dan memvalidasi → halaman tinjau → Aktifkan. Data aktif hanya berganti saat aktivasi berhasil.

## Dalam scope
- Tabel: impor (identitas file + SHA-256, sheet, tahun/bulan, status, pelaku, waktu), cakupan tanggal per toko, sel penjualan bernilai, master produk (kode, nama, ukuran, kategori, klasifikasi dari T06, status keluarga aroma `belum-dipetakan`).
- Unggah langsung ke storage S3 (presigned URL); worker pg-boss menjalankan T10; hasil masuk staging.
- Pemilih sheet: sheet `MP …` tampil tetapi tidak bisa dipilih ("di luar cakupan saat ini").
- Status impor terlihat: diunggah → diproses → siap ditinjau / gagal → aktif / diarsipkan. Tab boleh ditutup selama proses.
- Halaman tinjau: ringkasan per toko, daftar masalah (lokasi sel + cara memperbaiki), dan daftar produk baru.
- Aktifkan: hanya bila tidak ada error. Dalam satu transaksi, impor aktif lama untuk bulan yang sama diarsipkan dan produk baru didaftarkan.
- Form menampilkan keadaan sesuai CODING_STANDARDS. Aktivasi yang hasilnya belum pasti tidak diulang otomatis.
- Hanya admin (usulan OD-10).

## Di luar scope
Cache hasil hitung dan hitung ulang (tiket M2), halaman laporan, pemetaan keluarga aroma, dan impor sheet MP/BARDAT.

## Kriteria penerimaan
- [ ] Impor gagal atau belum selesai tidak mengubah impor aktif (test integrasi).
- [ ] Mengaktifkan impor kedua untuk bulan yang sama mengarsipkan yang pertama dalam satu transaksi (test integrasi).
- [ ] Sheet dengan error tidak bisa diaktifkan; tombol Aktifkan menjelaskan alasannya.
- [ ] Test Playwright alur bahagia dengan workbook kecil.
- [ ] Non-admin ditolak di server (test).
- [ ] `pnpm verify` hijau.

## Rujukan
PRD A1, A7, B8; ADR-0001, ADR-0002, ADR-0005, ADR-0006; OD-10

## Blocked by
- [T06], [T10], [T20], [T21]

## Pelaksana
A (Claude Code)
