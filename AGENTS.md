# AGENTS.md — Dashboard Penjualan MANDALIKA

Aplikasi web internal: impor penjualan Excel → laporan rata-rata bertahap → rencana jumlah kirim gudang ke toko. Antarmuka berbahasa Indonesia.

## Sumber kebenaran

- Ketika menyentuh aturan bisnis atau rumus: `docs/PRD.md` adalah satu-satunya sumber. Blok `▶ Revisi` dan `▶ Keputusan` mengalahkan teks di atasnya.
- Ketika menamai sesuatu (kode, test, issue, PR): pakai istilah `CONTEXT.md`.
- Ketika bekerja di sebuah area: baca ADR terkait di `docs/adr/`.
- Ketika tiket menyentuh hal yang belum diputuskan: lihat `docs/OPEN-DECISIONS.md`.
- Ketika menulis kode: ikuti `CODING_STANDARDS.md`.
- Contoh hitungan yang benar: `tests/golden/` (hanya-baca).

## Cara mengerjakan tiket

1. Ambil **satu** issue beserta komentarnya. Selesai jika kamu bisa mengutip daftar "Dalam scope" dan "Kriteria penerimaan"-nya.
2. Baca sumber kebenaran yang relevan dengan issue itu.
3. Tulis rencana singkat: berkas yang disentuh dan seam yang dites. Minta persetujuan manusia sebelum menulis kode.
4. Red → green: test dulu (pakai fixture golden yang disebut issue), lalu implementasi minimal sampai hijau.
5. Jalankan `pnpm verify` sampai hijau.
6. Buka PR dari branch `t<nomor-tiket>-<slug>`, isi template, sertakan `Closes #<nomor-issue>`.

Selesai = semua kriteria penerimaan issue tercentang **dan** `pnpm verify` hijau. Tidak ada tambahan setelah itu.

## Batas scope (pagar keras)

Hasil kerja = persis isi "Dalam scope" issue:

- Tambahkan fitur, halaman, endpoint, tabel, kolom, env var, opsi, abstraksi, dan dependency **hanya** jika issue menyebutnya. Dependency yang terasa perlu: tulis usulannya di PR, lalu tunggu.
- Refactor terbatas pada berkas yang memang diperlukan issue.
- Rumus diimplementasikan persis seperti PRD, termasuk pembulatan per tahap, walaupun terlihat bisa disederhanakan.
- Aturan tidak jelas atau bertentangan → **berhenti**, tanya manusia, komentari issue, beri label `needs-info`. Menebak dianggap gagal.
- Berkas terlindungi hanya diubah atas instruksi eksplisit pemilik: `docs/PRD.md`, `docs/adr/`, `docs/OPEN-DECISIONS.md`, `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`, `CODING_STANDARDS.md`, `src/domain/AGENTS.md`, `tests/golden/`, `package.json`, `.github/`.
- Test yang merah diperbaiki di kode, bukan di fixture golden.
- Merge, label `disetujui-pemilik`, dan force-push adalah tindakan manusia.

## Perintah

`pnpm verify` adalah gerbang wajib sebelum PR. Perintah lain: lihat `package.json`.

## Agent skills

### Issue tracker

GitHub Issues di repo ini, diakses dengan `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Lima label kanonik bawaan. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` dan `docs/adr/` di root. See `docs/agents/domain.md`.
