# Panduan Kerja (solo, Claude Code)

## Urutan tiket

T00 → T01 → T02 → T06 → T03 → T04 → T05 → T07 → T20 → T21 → T22 → T10 → T11

Ambil tiket berikutnya hanya setelah PR tiket sebelumnya di-merge.

## Satu tiket = satu sesi baru

Buka sesi baru di Claude Code, ganti `T01` dengan nomor tiket, lalu kirim:

```
/implement Kerjakan tiket [T01] dari GitHub Issues.

1. git checkout main && git pull, lalu buat branch t01-<nama-singkat>.
2. Baca issue lengkap (gh issue list --search "[T01] in:title", lalu gh issue view <nomor>
   --comments), AGENTS.md, dan dokumen yang ditunjuknya.
3. Sebelum menulis kode, jelaskan ke saya dengan bahasa sederhana: apa yang akan dibuat,
   berkas yang disentuh, dan test apa yang ditulis. Tunggu sampai saya bilang "lanjut".
4. Kerjakan hanya isi "Dalam scope". Jika ada aturan yang tidak jelas, berhenti dan tanya saya.
5. Selesai = semua kriteria penerimaan tercentang + pnpm verify hijau. Lalu push branch dan
   buka PR dengan template (Closes #<nomor>), dan berikan link PR-nya.
```

Lalu:
1. Rencana masuk akal → balas "lanjut". Tawaran di luar tiket → jawab "Tidak, sesuai tiket saja."
2. Buka link PR, tunggu CI hijau.
3. CI merah karena "berkas terlindungi" dan tiket memang mengizinkannya → beri label `disetujui-pemilik`.
4. Squash and merge, lalu tutup sesi.

Docker Desktop harus menyala.

## Situasi khusus

| Situasi | Ketik |
|---|---|
| Claude bertanya aturan bisnis | Jawab, lalu: "Catat jawaban saya sebagai keputusan di docs/OPEN-DECISIONS.md (Selesai) dan docs/PRD.md (▶ Keputusan), komentari issue-nya, lalu lanjutkan tiket." |
| Sesi terlalu panjang | `/handoff`, lalu tempel hasilnya di sesi baru |
| Error yang tidak beres | `/diagnosing-bugs` + penjelasan error |
| Ingin rencana diuji | `/grill-me` + rencananya |
| Semua tiket M1 selesai | `/to-tickets` untuk M2 (laporan, kalender, cache hitung, ekspor) |
