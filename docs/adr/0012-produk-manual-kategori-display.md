# Produk manual: display tester, kertas tester, dan kategori display

Status: accepted (2026-11-04) — keputusan pemilik; menggantikan ADR-0007

Produk ditangani manual (tanpa jumlah kirim dan tanpa buffer otomatis) jika memenuhi salah satu syarat berikut, diperiksa berurutan:

1. **Display tester**: kode produk berakhiran `-T`, apa pun kategorinya.
2. **Kertas tester**: kategori `KTP` atau `KTL`, dicocokkan persis.
3. **Display**: kategori `DISPLAY PRIA` atau `DISPLAY WANITA` setelah normalisasi (spasi di awal dan akhir dibuang, spasi ganda menjadi satu, huruf besar), apa pun kodenya. Termasuk display dummy (`DD-…`) dan display rework (`-R`).

Semua produk lain dihitung otomatis.

Aturan display berbasis kategori, bukan kode. Pemilik meminta "semua produk kategori DISPLAY PRIA dan DISPLAY WANITA", dan pola kode display tidak seragam (`DP…`, `DW…`, `DD-…`). Kategori display dinormalisasi supaya penulisan seperti `Display Pria` di Excel tidak diam-diam dihitung otomatis. Pencocokan `KTP`/`KTL` tetap persis seperti di ADR-0007, sesuai pilihan pemilik.

## Consequences

- Klasifikasi yang tersimpan di master produk dihitung ulang satu kali saat aturan ini berlaku. Draft yang belum final dan memuat produk yang klasifikasinya berubah ditandai perlu dihitung ulang. Rencana final lama tetap (snapshot).
- Golden: `tests/golden/klasifikasi-produk-2026-11-04.json`. Berkas `tests/golden/klasifikasi-produk.json` hanya mencatat aturan ADR-0007.
