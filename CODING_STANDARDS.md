# Standar Kode

Dibaca oleh agen saat menulis kode dan oleh skill `code-review` (sumbu Standards). Aturan yang ditegakkan tooling tidak perlu diulang dalam review.

## Bahasa dan penamaan

- TypeScript `strict`. Tidak ada `any`; untuk data dari luar pakai `unknown` lalu validasi dengan Zod.
- Konsep domain memakai istilah Indonesia dari `CONTEXT.md` (`kategoriEfektif`, `mingguLaporan`, `jumlahKirim`). Konsep pemrograman umum memakai bahasa Inggris (`parse`, `result`, `handler`).
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

- Dependency baru memerlukan persetujuan pemilik di PR (`package.json` dilindungi CODEOWNERS).
- Knip harus bersih: tidak ada berkas, export, atau dependency yang tidak dipakai.
