# Aturan bisnis hanya di modul domain murni

Status: accepted (2026-10-22) — dicatat saat adopsi kit jalankan-tiket; aturannya sudah berlaku sejak awal proyek (`src/domain/AGENTS.md`)

Proyek ini dibangun per tiket oleh agent otonom. Supaya aturan bisnis bisa diuji tanpa database dan tidak tersebar ke tampilan atau handler, semua aturan dari PRD ditempatkan di `src/domain/`.

Isi modul itu adalah fungsi murni dengan input → output yang deterministik. Fungsi-fungsi itu tidak memakai database, I/O, framework, maupun jam sistem. "Sekarang" selalu diterima sebagai parameter.

## Consequences

- Setiap aturan PRD punya fungsi yang dinamai dengan istilah `GLOSSARY.md`, beserta unit test yang memakai fixture `tests/golden/`.
- Lapisan lain, seperti server dan tampilan, memanggil domain lalu menampilkan hasilnya beserta bahan hitungnya.
- Pemeriksa impor di `pnpm verify` (aturan `domain-murni` di `.dependency-cruiser.cjs`) menolak setiap impor yang melanggar batas ini.
