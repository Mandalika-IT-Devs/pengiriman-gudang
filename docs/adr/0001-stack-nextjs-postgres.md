# Stack: Next.js + TypeScript + PostgreSQL, worker terpisah

Status: accepted (2026-10-08)

Aplikasi memakai Next.js (App Router) dengan TypeScript `strict`, pnpm, dan PostgreSQL lewat Drizzle ORM. Domainnya relasional dan transaksional: pengguna–gudang–toko–jadwal–persetujuan–rencana, constraint unik, aktivasi impor yang atomik, dan snapshot final yang tidak berubah. Agregasi bertahap juga alami ditulis dengan SQL. Snapshot finalisasi disimpan sebagai JSONB.

Pekerjaan berat (membaca Excel, menghitung ulang hasil laporan) berjalan di **worker Node terpisah** yang memakai antrean pg-boss di PostgreSQL yang sama, bukan di request halaman. File unggahan disimpan di object storage yang kompatibel S3 (MinIO saat pengembangan lokal), diunggah langsung dari browser lewat presigned URL. Excel dibaca dengan SheetJS (Community Edition) hanya untuk sheet yang dipilih. Autentikasi memakai Better Auth (email + kata sandi, akun dibuat admin). UI memakai Tailwind dan komponen shadcn/ui yang ditambahkan per kebutuhan tiket; tabel memakai TanStack Table dengan pagination di server. Test memakai Vitest dan Playwright.

## Considered Options

- **MongoDB / dokumen JSON**: ditolak. Kita akan menulis ulang sendiri constraint, transaksi, dan join yang sudah disediakan PostgreSQL.
- **Membaca Excel/CSV setiap kali halaman dibuka**: ditolak. Membuka workbook 17 MB saja butuh sekitar 9 detik.
- **Parsing di request serverless**: ditolak. Batas ukuran body dan durasi fungsi lebih kecil dari kebutuhan file.

## Consequences

Target hosting harus bisa menjalankan proses worker yang hidup lama, PostgreSQL di region Singapura, dan storage S3. Pilihan penyedia: OD-04.
