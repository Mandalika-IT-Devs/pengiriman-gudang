# [T04] Mesin laporan bertahap (mingguan → bulanan → Ringkasan)
<!-- labels: ready-for-agent,M1,pelaksana:C -->

## Yang dibangun
Fungsi domain murni yang menghitung laporan untuk satu pasangan produk–toko, dari pengamatan harian dan pemetaan kategori efektif. Setiap hasil membawa jumlah, pembagi, dan penanda kelengkapan.

## Dalam scope
- Input: daftar pengamatan `{ tanggal, qty, selSumber }` (hanya tanggal teramati; nol tersirat sudah diisi pemanggil), fungsi kategori efektif per tanggal, dan bulan laporan pilihan (1–12, boleh tidak berurutan).
- Tahap 1, nilai mingguan per (bulan laporan, minggu laporan, kategori): Senin–Kamis = ⌈total / jumlah tanggal teramati⌉; Jumat/Sabtu/Minggu = total.
- Tahap 2, rata-rata bulanan = ⌈Σ nilai mingguan / jumlah minggu yang punya pengamatan⌉.
- Tahap 3, Ringkasan = ⌈Σ rata-rata bulanan / jumlah bulan pilihan yang punya hasil⌉. Bulan tanpa hasil tidak menambah pembagi.
- Perbandingan minggu sama antarbulan = ⌈Σ nilai pada indeks minggu sama / jumlah bulan yang punya nilai itu⌉.
- Total penjualan mentah per bulan laporan, sebagai field terpisah dengan nama berbeda dari hasil rata-rata.
- Penanda kelengkapan sesuai usulan OD-08 (lihat docs/OPEN-DECISIONS.md).
- Semua pembulatan lewat modul angka (T01).

## Di luar scope
Penyimpanan cache, query database, UI, dan ekspor.

## Kriteria penerimaan
- [ ] `tests/golden/laporan-15GL-GOR-PMS-juni.json`: semua nilai mingguan dan rata-rata bulanan Juni cocok. Total mentah Juni = 4. Kelompok Senin–Kamis Juli Minggu 1 dari 29–30 Juni bertanda parsial.
- [ ] Kasus literal: rata-rata bulanan Juni 1 dan Juli 2 → Ringkasan ⌈3/2⌉ = 2. Bulan pilihan tanpa hasil tidak mengubah pembagi.
- [ ] Kasus literal minggu sama: Minggu 1 Juni = 1, Minggu 1 Juli = 3 → ⌈4/2⌉ = 2.
- [ ] Setiap hasil memuat jumlah dan pembaginya.
- [ ] `pnpm verify` hijau.

## Rujukan
PRD A2, B5–B7; ADR-0002; OD-08, OD-09

## Blocked by
- [T01], [T02], [T03]

## Pelaksana
C (Codex)
