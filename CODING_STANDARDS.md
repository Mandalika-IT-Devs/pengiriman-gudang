# Standar Kode

Dibaca oleh subagent `tiket:pelaksana` saat menulis kode dan oleh `tiket:peninjau` pada sumbu Standards. Aturan yang ditegakkan tooling lewat `pnpm verify` tidak perlu diulang dalam review.

## Bahasa dan penamaan

- TypeScript `strict`. Tidak ada `any`; untuk data dari luar pakai `unknown` lalu validasi dengan Zod.
- Konsep domain memakai istilah Indonesia dari `GLOSSARY.md` (`kategoriEfektif`, `mingguLaporan`, `jumlahKirim`). Konsep pemrograman umum memakai bahasa Inggris (`parse`, `result`, `handler`).
- Teks antarmuka berbahasa Indonesia.

## Batas modul

- `src/domain/`: rumus murni (lihat `src/domain/AGENTS.md`).
- Kode server (database, worker, storage) memanggil domain, bukan sebaliknya.
- Komponen UI tidak menghitung rumus. UI menampilkan hasil beserta jumlah dan pembaginya.

## Angka dan tanggal

- Pembulatan dan buffer hanya lewat modul angka domain, dengan bilangan bulat dan buffer dalam persen bulat (ADR-0008). Lint menolak `Math.ceil`, `Math.floor`, dan `Math.round` di luar modul itu.
- Tanggal bisnis disimpan sebagai tipe `DATE` di PostgreSQL dan `TanggalBisnis` (`YYYY-MM-DD`) di TypeScript. Hindari `new Date(...)` untuk tanggal bisnis. Sel tanggal Excel dibaca sebagai nilai mentah (`cellDates: false`), lalu nomor seri dikonversi dengan aritmetika kalender.
- Tampilan tanggal: `Jumat, 05-06-2026`.

## Kewenangan

- Setiap server action dan route handler memeriksa peran dan hak tindakan **di server**, sebelum membaca atau menulis data. Menyembunyikan tombol di UI hanya tambahan.
- "Admin" tidak memberi hak operator. Hak operator berasal dari penugasan gudang.

## Penyimpanan dan status

- Setiap form menampilkan empat keadaan dekat bagian yang dikerjakan: belum disimpan, sedang menyimpan, berhasil, gagal. Ada juga keadaan kelima: "tersimpan, tetapi gagal memuat ulang tampilan".
- Tulis data yang hasilnya belum pasti (timeout, jaringan putus) **tidak** diulang otomatis. Tampilkan status "belum pasti" dan cara memeriksanya.
- Operasi massal mengembalikan hasil per item.
- Aktivasi impor dan finalisasi berjalan dalam satu transaksi database.
- Migrasi dibuat dengan Drizzle Kit. Migrasi yang sudah di-merge tidak diubah; perubahan dibuat sebagai migrasi baru.

## Test

- Test berada di seam publik yang disebut issue. Lihat skill `tdd`.
- Fixture `tests/golden/` adalah hanya-baca. Ekspektasi test berasal dari fixture, PRD, atau contoh literal, bukan dari rumus yang sama dengan kode.
- Data bisnis asli (workbook) tidak di-commit. Test membuat workbook kecil sendiri.

## Dependency

- Dependency baru hanya dari `.github/dependency-allowlist.txt`. Job CI `kebersihan-pr` menolak dependency di luar daftar itu, dan daftar itu hanya berubah lewat PR berlabel `disetujui-pemilik`.
- Knip harus bersih: tidak ada berkas, export, atau dependency yang tidak dipakai.

## Daftar periksa peninjau (review checklist)

<!-- Aturan khusus proyek ini, yang diperiksa tiket:peninjau di setiap tiket. Satu butir per baris, dan setiap butir
harus bisa dicek lulus/gagal. Butir bisa ditambah lewat keputusan pemilik atau dari hasil /retro. -->

- Setiap server action dan route handler memeriksa peran dan hak tindakan di server sebelum membaca atau menulis data.
- Rumus dengan pembagian, pembulatan, atau buffer memakai modul angka domain dengan bilangan bulat (ADR-0008).
- Tanggal bisnis bertipe `TanggalBisnis` (`YYYY-MM-DD`), tidak dibuat dengan `new Date(...)`.
- Setiap form menampilkan lima keadaan simpan: belum disimpan, sedang menyimpan, berhasil, gagal, dan "tersimpan, tetapi gagal memuat ulang tampilan".
- Tulis data yang hasilnya belum pasti tidak diulang otomatis; tampilan menunjukkan status "belum pasti" dan cara memeriksanya.
- Tampilan mengikuti zona `docs/DESIGN.md` (zona suasana dan zona kerja).
- Warna memakai token `docs/DESIGN.md`, tanpa kode hex di komponen.
- Status ditampilkan dengan ikon dan teks, tidak dengan warna saja.
- Angka di tabel rata kanan.
