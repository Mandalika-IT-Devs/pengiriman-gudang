# Modul domain

Kode di sini **murni**: input → output yang deterministik. Ini tempat rumus PRD hidup.

- Hanya mengimpor dari `src/domain/` dan pustaka bawaan TypeScript. Tanpa database, Next.js, React, I/O, jam sistem, maupun dependency npm. dependency-cruiser menegakkan aturan ini.
- Tanggal bisnis = string `YYYY-MM-DD` (tipe `TanggalBisnis`). Operasi tanggal dihitung dengan aritmetika kalender, bukan objek `Date`.
- Pembagian dengan pembulatan ke atas dan buffer hanya lewat modul angka (ADR-0008).
- Setiap fungsi publik yang disebut issue diuji dengan fixture di `tests/golden/`. Ekspektasi test diambil dari fixture atau PRD, tidak dihitung ulang dengan rumus yang sama.
- Hasil hitung membawa jumlah dan pembaginya, supaya UI bisa menampilkan asal angka.
