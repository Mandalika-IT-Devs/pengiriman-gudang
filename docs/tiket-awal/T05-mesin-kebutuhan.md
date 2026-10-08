# [T05] Mesin kebutuhan barang dan jumlah kirim
<!-- labels: ready-for-agent,M1,pelaksana:C -->

## Yang dibangun
Fungsi domain murni untuk satu toko–varian dan satu tanggal kirim: daftar tanggal cakupan dengan kategori efektifnya, kebutuhan barang, dan jumlah kirim atau status yang menahan finalisasi.

## Dalam scope
- Cakupan H−p sampai H+L−1 inklusif. p ∈ {0,1,2}. L = 7 untuk mingguan (termasuk 2×/3× seminggu), 14 untuk dua mingguan.
- Kebutuhan = Σ rata-rata kategori efektif setiap tanggal cakupan. Rata-rata per kategori adalah input.
- Status: `manual` (produk manual: tanpa jumlah kirim, tanpa buffer), `stok-belum-diisi`, `stok-negatif` (produk otomatis), `kebutuhan-tidak-tersedia` (ada kategori di cakupan yang tidak punya rata-rata), atau `siap` dengan jumlah kirim lewat modul angka (T01).
- Persen buffer adalah input. Penentuannya dari ranking ada di tiket lain.

## Di luar scope
Jadwal, ranking, penyimpanan draft, finalisasi, dan UI.

## Kriteria penerimaan
- [ ] `tests/golden/jumlah-kirim.json` → `kasusCakupan`: 9 tanggal (Sabtu 06-06-2026 s.d. Minggu 14-06-2026), kebutuhan 56. `kasusStatus` lulus.
- [ ] Contoh pemilik end-to-end: kebutuhan 56, stok 20, buffer 20 → 44.
- [ ] `pnpm verify` hijau.

## Rujukan
PRD A6; ADR-0007, ADR-0008

## Blocked by
- [T01], [T03], [T06]

## Pelaksana
C (Codex)
