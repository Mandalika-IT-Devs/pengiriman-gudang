# Keputusan Terbuka

Daftar hal yang **belum diputuskan pemilik**. Agen tidak mengimplementasikan perilaku yang bergantung pada butir terbuka. Jika tiket menyentuh butir terbuka, agen berhenti, mengomentari issue, dan memberi label `needs-info`. Hanya pemilik yang mengubah berkas ini. Setelah diputuskan, butir dipindah ke bagian "Selesai" beserta rujukan ADR atau PRD-nya.

## Terbuka

| ID | Pertanyaan | Menahan | Usulan sementara (berlaku hanya jika ditulis di tiket) |
|---|---|---|---|
| OD-01 | Bagaimana kuantitas **negatif** di sel penjualan diperlakukan (retur? koreksi?). Data: `APRIL (S)!MY29` (BXC, 17-04-2026, A10M-IRR, −1) dan `MEI (S)!PJ346` (KOKAS, 18-05-2026, V2P-SED, −1). | T10: impor April & Mei | Error yang menahan publikasi, dengan pesan "menunggu keputusan OD-01". |
| OD-02 | Nama empat gudang selain Pusat, dan toko mana terhubung ke gudang mana. | T21: data awal | — (data, bukan kode) |
| OD-03 | Bolehkah satu toko terhubung ke lebih dari satu gudang? | T21: tambah toko massal | — |
| OD-04 | Penyedia hosting. Syarat: worker yang hidup lama, PostgreSQL region Singapura, storage S3. | Deploy (bukan M1) | — |
| OD-05 | Struktur file ranking pusat: kolom apa, dan bagaimana keluarga aroma ditulis di dalamnya. | Tiket ranking (M3) | — |
| OD-06 | Siapa yang berwenang atas "pengaturan langsung Pusat" untuk jadwal (PRD A5). | Tiket jadwal (M3) | — |
| OD-07 | Cakupan laporan untuk viewer: semua toko, atau toko gudang tertentu? | Tiket laporan (M2) | — |
| OD-08 | Definisi persis **penanda kelengkapan**. | T04 | Kelompok mingguan *parsial* jika ada tanggal anggotanya yang tidak teramati (contoh: Senin–Kamis Juli M1 baru teramati 29–30 Juni). Rata-rata bulanan *parsial* jika ada kelompok mingguan pembentuknya yang parsial. |
| OD-09 | Konfirmasi angka harapan di `tests/golden/laporan-15GL-GOR-PMS-juni.json` (Senin–Kamis 1, Jumat 0, Sabtu 1, Minggu 0). | T04 (golden) | Dipakai; ditandai menunggu konfirmasi. |
| OD-10 | Siapa yang boleh mengunggah dan mengaktifkan impor penjualan? | T11 | Admin saja. |
| OD-11 | Konfirmasi target performa di PRD C1. | — | Dipakai sebagai target. |

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
