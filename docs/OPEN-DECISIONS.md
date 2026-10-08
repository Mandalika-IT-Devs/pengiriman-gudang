# Keputusan Terbuka

Daftar hal yang **belum diputuskan pemilik**. Agen tidak mengimplementasikan perilaku yang bergantung pada butir terbuka. Jika tiket menyentuh butir terbuka, agen berhenti, mengomentari issue, dan memberi label `needs-info`. Hanya pemilik yang mengubah berkas ini. Setelah diputuskan, butir dipindah ke bagian "Selesai" beserta rujukan ADR atau PRD-nya.

## Terbuka

| ID | Pertanyaan | Menahan | Usulan sementara (berlaku hanya jika ditulis di tiket) |
|---|---|---|---|
| OD-04 | Penyedia hosting. Syarat: worker yang hidup lama, PostgreSQL region Singapura, storage S3. | Deploy (bukan M1) | — |
| OD-05 | Struktur file ranking pusat: kolom apa, dan bagaimana keluarga aroma ditulis di dalamnya. | Tiket ranking (M3) | — |
| OD-06 | Siapa yang berwenang atas "pengaturan langsung Pusat" untuk jadwal (PRD A5). | Tiket jadwal (M3) | — |
| OD-07 | Cakupan laporan untuk viewer: semua toko, atau toko gudang tertentu? | Tiket laporan (M2) | — |
| OD-11 | Konfirmasi target performa di PRD C1. | — | Dipakai sebagai target. |
| OD-12 | Toko mana terhubung ke gudang mana (sisa OD-02). Menyusul dari pemilik sebagai data. | Data awal hubungan toko–gudang (tidak menahan kode T21) | — (data, bukan kode) |

## Tindakan pemilik (bukan keputusan)

| ID | Tindakan |
|---|---|
| TP-01 | Perbaiki workbook: `SEPTEMBER (S)` memiliki 749 sel berisi penjualan pada kolom `31/9` (contoh: PMS `AJ11`, SENTUL `AAP4`). Impor September tertahan sampai diperbaiki. |
| TP-02 | Ganti `@GANTI-PEMILIK` di `.github/CODEOWNERS` dengan username GitHub pemilik. |

## Ditunda (di luar scope tahap ini)

- Sheet `MP … (S)` (PUSAT, DEPOK, KARAWACI, KEMANG): makna dan hubungannya dengan toko/gudang.

## Selesai

| Keputusan | Rujukan |
|---|---|
| Periode sumber gudang ditetapkan admin, satu per gudang | ADR-0003 |
| Penomoran minggu, libur, tanggal invalid | PRD Bagian B, ADR-0004, ADR-0005 |
| Klasifikasi manual: display tester `-T` dan kertas tester `KTP`/`KTL` | ADR-0007 |
| Keluarga aroma dan rework | ADR-0006 |
| Fokus sheet `(S)`; sheet MP ditunda | ADR-0005 |
| "ASOY" adalah salah ketik | PRD B2 |
| OD-01: kuantitas negatif di sel penjualan adalah salah input; harus diperbaiki di Excel sebelum impor (2026-10-09) | PRD A1; T10 |
| OD-02 (bagian nama): lima gudang = Pusat, Gudang Bali, Gudang Bandung, Gudang Cibubur, Gudang Jabodetabek (2026-10-09). Pemetaan toko ke gudang → OD-12 | PRD A3; T21 |
| OD-03: satu toko tidak boleh terhubung ke lebih dari satu gudang (2026-10-09) | ADR-0009, PRD A3; T21 |
| OD-08: definisi penanda kelengkapan sesuai usulan (2026-10-09) | PRD A2; T04 |
| OD-09: angka harapan `laporan-15GL-GOR-PMS-juni.json` (Senin–Kamis 1, Jumat 0, Sabtu 1, Minggu 0) benar (2026-10-09) | PRD A2; T04 |
| OD-10: hanya admin yang boleh mengunggah dan mengaktifkan impor (2026-10-09) | PRD A3; T11 |
