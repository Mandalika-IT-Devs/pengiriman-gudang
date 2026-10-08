# [T03] Kategori efektif dari perubahan kategori
<!-- labels: ready-for-agent,M1,pelaksana:C -->

## Yang dibangun
Fungsi domain murni yang menentukan kategori efektif satu tanggal untuk satu toko, dari daftar perubahan kategori yang diberikan sebagai input.

## Dalam scope
- `kategoriEfektif(tanggal, toko, daftarPerubahan)` → `{ kategoriEfektif, sumberKategori: idPerubahan | 'dasar' }`.
- Prioritas: perubahan aktif khusus toko → perubahan aktif semua-toko → kategori dasar. Di dalam tanggal dan cakupan yang sama, pakai revisi aktif terbesar. Perubahan berstatus dibatalkan diabaikan.
- Posisi bulan dan minggu laporan tetap dari T02 (tanggal asli). Fungsi ini tidak mengubahnya.

## Di luar scope
Penyimpanan perubahan, UI kalender, dan sinkronisasi libur.

## Kriteria penerimaan
- [ ] Semua kasus di `tests/golden/kategori-efektif.json` lulus, termasuk contoh 30 Juni → Jumat, tetap Juli Minggu 1.
- [ ] `pnpm verify` hijau.

## Rujukan
PRD B4, B6; ADR-0004

## Blocked by
- [T02]

## Pelaksana
C (Codex)
