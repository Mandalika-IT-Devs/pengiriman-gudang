# [T00] Fondasi repo dan pagar otomatis
<!-- labels: ready-for-human,M0,pelaksana:A -->

## Yang dibangun
Kerangka aplikasi kosong yang bisa dijalankan lokal dan diverifikasi dengan satu perintah. Semua pagar otomatis dari CODING_STANDARDS sudah aktif. Belum ada fitur bisnis.

## Dalam scope
- Next.js (App Router), TypeScript `strict`, pnpm (`packageManager` diisi), Tailwind. Satu halaman beranda polos bertuliskan "Dashboard Penjualan MANDALIKA".
- Docker Compose untuk pengembangan lokal: PostgreSQL 16 dan MinIO. Tambahkan `.env.example`.
- Drizzle ORM + Drizzle Kit, dengan skrip migrasi (belum ada tabel bisnis).
- Vitest. Satu test yang memastikan setiap berkas di `tests/golden/` adalah JSON valid dan punya field `sumber`.
- ESLint dengan aturan yang menolak `Math.ceil`/`Math.floor`/`Math.round` di semua tempat kecuali modul angka domain (ADR-0008).
- dependency-cruiser: modul domain hanya boleh mengimpor dari modul domain.
- Knip.
- Skrip `pnpm verify` = typecheck + lint + knip + depcruise + test.

## Di luar scope
Autentikasi, tabel bisnis, komponen UI selain beranda, worker, deploy, dan library komponen. shadcn/ui ditambahkan nanti oleh tiket yang membutuhkannya.

## Kriteria penerimaan
- [ ] Dari clone bersih: `docker compose up -d && pnpm install && pnpm verify` hijau.
- [ ] Job `verify` di CI hijau pada PR ini.
- [ ] Bukti di deskripsi PR bahwa lint gagal jika `Math.ceil` dipakai di luar modul angka, dan bahwa depcruise gagal jika modul domain mengimpor `drizzle-orm`. Cukup tempel output-nya; jangan commit berkas pemicunya.
- [ ] PR diberi label `disetujui-pemilik` oleh pemilik, karena `package.json` adalah berkas terlindungi.

## Rujukan
ADR-0001, ADR-0008, CODING_STANDARDS.md

## Blocked by
- None (can start immediately)

## Pelaksana
A (Claude Code). Tiket ini satu-satunya yang berjalan sendirian; tiket lain menunggu T00 di-merge.
