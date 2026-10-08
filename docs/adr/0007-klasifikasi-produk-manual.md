# Hanya display tester dan kertas tester yang ditangani manual

Status: accepted (2026-10-08) — koreksi pemilik atas kalimat PRD A6

Produk ditangani manual (tanpa jumlah kirim dan tanpa buffer otomatis) jika memenuhi salah satu syarat:

- **Display tester**: kode produk berakhiran `-T`, apa pun kategorinya. Di data ada tester berkategori `PARFUM PRIA`.
- **Kertas tester**: kategori `KTP` atau `KTL`. Aturan ini berbasis kategori karena ada kertas tester berkode `KTB-…` yang berkategori `KTP`.

Semua produk lain dihitung otomatis, termasuk display biasa, display dummy, display rework, ATOMIZER, GIFT SET, HAMPERS, KEMASAN, VIAL, dan ALKOHOL. Kalimat awal PRD ("Display, display tester, dan kertas tester ditangani manual") direvisi oleh pemilik.
