# [T06] Klasifikasi produk manual / otomatis
<!-- labels: ready-for-agent,M1,pelaksana:C -->

## Yang dibangun
Fungsi domain murni yang mengklasifikasikan satu produk dari kode dan kategorinya.

## Dalam scope
- `klasifikasiProduk(kode, kategori)` → `{ klasifikasi: 'manual' | 'otomatis', alasan?: 'display-tester' | 'kertas-tester' }`.
- Aturan ADR-0007: kode berakhiran `-T` → display tester; kategori `KTP`/`KTL` → kertas tester; selain itu otomatis.

## Di luar scope
Keluarga aroma, penyimpanan master produk, dan UI.

## Kriteria penerimaan
- [ ] Semua kasus di `tests/golden/klasifikasi-produk.json` lulus.
- [ ] `pnpm verify` hijau.

## Rujukan
ADR-0007

## Blocked by
- [T00]

## Pelaksana
C (Codex)
