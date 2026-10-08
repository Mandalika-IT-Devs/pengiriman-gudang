# Panduan Kerja (otomatis, Claude Code)

Peran Anda: **pemilik produk**. Claude Code mengerjakan, meninjau, dan me-merge tiket sendiri. Anda menjawab pertanyaan bisnis saat diminta dan melakukan UAT di akhir.

## Menjalankan

1. Nyalakan Docker Desktop. Colokkan laptop ke listrik dan matikan mode tidur otomatis selama berjalan.
2. Di Claude Code (tab Code di Claude Desktop), buka sesi baru di folder repo.
3. Pilih mode izin **Auto** jika tersedia. Jika tidak, pilih **Bypass permissions** ("Menerima semua izin").
4. Ketik: `/jalankan-tiket`
5. Biarkan berjalan. Satu tiket = satu putaran: pelaksana → peninjau → PR → CI → merge.

Jika berhenti karena kuota atau laptop mati: buka sesi baru dan ketik `/jalankan-tiket` lagi. Pekerjaan berlanjut dari keadaan di GitHub.

## Saat berhenti dengan laporan akhir

- **Ada tiket yang diparkir (`needs-info`)**: laporan berisi pertanyaannya. Jawab di sesi Claude Code:

  ```
  Ini jawaban saya sebagai pemilik produk untuk tiket yang diparkir:
  [Txx]: ...
  Catat sebagai keputusan di docs/OPEN-DECISIONS.md (Selesai) dan docs/PRD.md (▶ Keputusan),
  perbarui issue-nya, hapus label needs-info, commit lewat PR dengan label disetujui-pemilik
  (instruksi eksplisit saya), lalu jalankan /jalankan-tiket.
  ```

- **Semua tiket tahap ini tertutup**: rencanakan tahap berikutnya (bagian bawah), lalu jalankan `/jalankan-tiket` lagi.

## Merencanakan tahap berikutnya (interaktif, sekali per tahap)

Ini satu-satunya sesi yang membutuhkan Anda aktif menjawab:

```
/to-tickets Baca docs/PRD.md, docs/OPEN-DECISIONS.md, dan kode yang sudah ada. Buat tiket untuk
SISA seluruh aplikasi (M2 dan M3):
- M2: cache hasil hitung + hitung ulang, halaman Ringkasan (filter, Terapkan, periode aktif),
  penelusuran angka sampai sel, ekspor seluruh hasil filter, kalender, sinkronisasi snapshot libur,
  perubahan kategori, pemetaan keluarga aroma.
- M3: periode sumber gudang, jadwal + usulan + persetujuan, template jadwal, ranking pusat,
  input stok, draft + hitung ulang, finalisasi + snapshot, ekspor rencana.
- Tiket terakhir [T99] Paket UAT lokal: satu perintah `pnpm uat` (docker compose up, migrasi,
  seed admin + 5 gudang + 25 toko), dan docs/UAT.md berisi skenario uji per bagian PRD dalam
  bahasa sederhana. Blocked by semua tiket lain.
Tanyakan saya untuk setiap butir OPEN-DECISIONS yang masih terbuka sebelum membuat tiket yang
bergantung padanya. Setiap tiket memakai format issue yang sudah ada (Dalam scope, Di luar scope,
Kriteria penerimaan, Rujukan, Blocked by) dan label ready-for-agent.
```

## UAT di akhir

Setelah T99 selesai: `pnpm uat`, buka `http://localhost:3000`, lalu ikuti `docs/UAT.md`. Temuan UAT dilaporkan ke Claude Code sebagai tiket perbaikan baru.
