# [T01] Modul angka: pembagian bulat-ke-atas dan buffer integer
<!-- labels: ready-for-agent,M1,pelaksana:C -->

## Yang dibangun
Satu modul domain kecil yang menjadi satu-satunya tempat pembulatan ke atas dan penerapan buffer, dengan aritmetika bilangan bulat.

## Dalam scope
- `bagiBulatAtas(jumlah, pembagi)`: jumlah ≥ 0 dan pembagi > 0, keduanya bilangan bulat; mengembalikan ⌈jumlah/pembagi⌉.
- `hitungJumlahKirim(kebutuhan, stokAkhir, persenBuffer)`: mengembalikan max(0, ⌈(kebutuhan − stokAkhir) × (100 + persenBuffer) / 100⌉) secara integer.
- Input yang bukan bilangan bulat atau di luar domain → error yang jelas (throw).

## Di luar scope
Penentuan buffer dari ranking, status stok, klasifikasi, dan fungsi lain.

## Kriteria penerimaan
- [ ] Semua `kasusJumlahKirim` di `tests/golden/jumlah-kirim.json` lulus, termasuk jebakan float 30/20/10% → 11.
- [ ] `bagiBulatAtas`: (0,4)=0, (1,4)=1, (2,4)=1, (4,4)=1, (5,4)=2.
- [ ] `pnpm verify` hijau.

## Rujukan
PRD A6, ADR-0008

## Blocked by
- [T00]

## Pelaksana
C (Codex)
