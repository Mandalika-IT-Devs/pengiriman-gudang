# [T02] Kalender laporan: kategori dasar, tanggal acuan, bulan & minggu laporan
<!-- labels: ready-for-agent,M1,pelaksana:C -->

## Yang dibangun
Fungsi domain murni: untuk satu tanggal bisnis, kembalikan kategori dasar, tanggal acuan, bulan laporan, dan minggu laporan. Juga formatter tampilan tanggal Indonesia.

## Dalam scope
- Tipe `TanggalBisnis` (`YYYY-MM-DD`) beserta validasinya.
- `posisiLaporan(tanggal)` → `{ kategoriDasar, tanggalAcuan, bulanLaporan: 'YYYY-MM', mingguLaporan }` sesuai PRD B5.
- `formatTanggal(tanggal)` → `Jumat, 05-06-2026`.
- Aritmetika kalender tanpa objek `Date`.

## Di luar scope
Libur, perubahan kategori, parsing header Excel, dan UI.

## Kriteria penerimaan
- [ ] Semua kasus di `tests/golden/kalender-minggu-laporan.json` lulus.
- [ ] `formatTanggal('2026-06-05')` = `Jumat, 05-06-2026`.
- [ ] `pnpm verify` hijau.

## Rujukan
PRD B4, B5, B8; ADR-0004

## Blocked by
- [T00]

## Pelaksana
C (Codex)
