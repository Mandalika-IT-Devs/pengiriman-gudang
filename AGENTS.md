# AGENTS.md — Dashboard Penjualan MANDALIKA

Aplikasi web internal untuk admin dan operator gudang MANDALIKA: impor penjualan Excel → laporan rata-rata bertahap → rencana jumlah kirim dari gudang ke toko. Tidak mencakup konfirmasi pengiriman fisik dan penerimaan barang, model safety stock, maupun pendaftaran akun mandiri. Antarmuka berbahasa Indonesia.

## Bahasa

Semua yang ditulis untuk pemilik memakai bahasa Indonesia: setiap pesan di percakapan, termasuk baris status singkat di sela perintah seperti "Sekarang CI: …", juga issue, PR, komentar, dan commit. Satu pesan memakai satu bahasa saja.

## Sumber kebenaran

- Ketika menyentuh aturan bisnis atau rumus: `docs/PRD.md` adalah satu-satunya sumber. Blok `▶ Revisi` dan `▶ Keputusan` mengalahkan teks di atasnya. Bahan di `docs/input/` bukan aturan.
- Ketika menamai sesuatu (kode, test, issue, PR): pakai istilah `GLOSSARY.md`, termasuk daftar _Avoid_-nya.
- Ketika bekerja di sebuah area: baca ADR terkait di `docs/adr/`. Stack dicatat di ADR-0001. Aturan bisnis hanya boleh ada di modul domain murni (ADR-0011).
- Ketika tiket menyentuh hal yang belum diputuskan: lihat `docs/OPEN-DECISIONS.md`. Nilai contohnya dipakai di seed dan test dengan tanda `[CONTOH]`, bukan sebagai aturan.
- Ketika menulis kode: ikuti `CODING_STANDARDS.md`. Modul domain punya aturannya sendiri di `src/domain/AGENTS.md`.
- Ketika membuat atau mengubah tampilan: ikuti `docs/DESIGN.md`.
- Contoh hitungan yang benar: `tests/golden/` (hanya-baca).
- Skenario penerimaan per bagian PRD: `docs/UAT.md`.
- Konfigurasi kit jalankan-tiket: `.github/jalankan-tiket.json`.

## Cara kerja: otomatis

Tiket dikerjakan tanpa menunggu manusia oleh plugin `tiket` dari kit jalankan-tiket, dengan urutan ini:

```
/tiket:jalankan → subagent tiket:pelaksana → subagent tiket:peninjau → PR → CI → merge
```

Pemilik produk menjawab tiket yang diparkir dan melakukan UAT di akhir. Panduan pemilik ada di `docs/GUIDE.md`.

Satu tiket selesai = semua kriteria penerimaan tercentang, `pnpm verify` hijau, `tiket:peninjau` memberi `PASS`, dan CI hijau. Tidak ada tambahan setelah itu.

### Ketidakjelasan

- **Teknis** (struktur kode, pola, cara menguji): putuskan, lalu catat di PR sebagai `Keputusan teknis: <apa> — <alasan> — <risiko jika salah>`.
- **Bisnis** (rumus, angka, kewenangan, apa yang dilihat pengguna, perilaku di luar issue/PRD) atau aturan yang tidak jelas/bertentangan: **jangan diputuskan.** Menebak dianggap gagal. Parkir tiket dengan label `needs-info` dan pertanyaan untuk pemilik, lalu lanjut ke tiket lain.
- **Detail visual kecil** yang tidak diatur `docs/DESIGN.md` (warna, ikon, atau jarak untuk satu elemen) adalah keputusan **teknis**. Putuskan dengan token dan ikon yang sudah ada, lalu catat sebagai keputusan teknis. Tetap parkir jika menyangkut kontras di bawah standar `docs/DESIGN.md` atau menambah elemen/perilaku baru.
- **Urutan tampil item dalam sebuah daftar** (status, masalah, kolom) yang tidak diatur PRD adalah keputusan **teknis**, selama semua item tetap ditampilkan. Putuskan, lalu catat sebagai keputusan teknis.

Nilai di `docs/OPEN-DECISIONS.md` adalah pertanyaan bisnis yang sudah punya nilai contoh, jadi tiket tidak perlu diparkir. Pakai nilai contohnya dengan tanda `[CONTOH]`, sebut OD-nya di PR, lalu lanjutkan.

## Batas scope (pagar keras)

Hasil kerja = persis isi "Dalam scope" issue:

- Tambahkan fitur, halaman, endpoint, tabel, kolom, env var, opsi, dan abstraksi **hanya** jika issue menyebutnya.
- Dependency hanya dari `.github/dependency-allowlist.txt`. Di luar daftar itu → parkir tiket.
- Refactor terbatas pada berkas yang memang diperlukan issue.
- Rumus diimplementasikan persis seperti PRD, termasuk pembulatan per tahap, walaupun terlihat bisa disederhanakan.
- Test yang merah diperbaiki di kode, bukan di fixture golden.
- Perubahan masuk ke `main` hanya lewat PR dengan CI hijau. Force-push adalah tindakan manusia.

### Berkas terlindungi

Daftar berkas terlindungi ada di `.github/protected-paths.txt`. Aturannya:
- Berkas itu hanya diubah atas instruksi eksplisit pemilik, di issue atau di komentar.
- PR yang mengubahnya wajib berlabel `disetujui-pemilik`, dan CI menolak PR tanpa label itu.
- Hanya pemilik yang memasang label itu.

## Lingkungan

- Lokal: salin `.env.example` menjadi `.env`, lalu `docker compose up -d` untuk menyalakan PostgreSQL di port 55432 dan MinIO di port 59000. Docker Desktop harus menyala.
- Test: vitest dan playwright memuat `.env.ci`, yang menunjuk PostgreSQL (database `mandalika_test`) dan MinIO lokal proyek ini. `pnpm verify` dan `pnpm test:e2e` berjalan tanpa override, dan database pengembangan `mandalika` tidak tersentuh. Database test dibuat ulang setiap putaran test.
- CI menyediakan PostgreSQL di `localhost:5432` (user `mandalika`, sandi `mandalika`, db `mandalika_test`) dan MinIO di `localhost:9000` (`minioadmin` / `minioadmin`). CI mengganti port di `.env.ci` ke layanan miliknya, lalu memuat variabelnya. `.env.ci` tidak berisi rahasia asli.
- CI menjalankan `pnpm verify`, lalu `pnpm test:e2e` jika skripnya ada.

## Perintah

`pnpm verify` adalah gerbang wajib sebelum commit dan di CI. Perintah lain: lihat `package.json`.

## Agent skills

### Issue tracker

GitHub Issues di repo ini, diakses dengan `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Lima label kanonik bawaan. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` dan `docs/adr/` di root. See `docs/agents/domain.md`.
