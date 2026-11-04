# Bahan M7: display manual, admin bertindak sebagai operator, toko acuan

Disusun 2026-11-04 dari pemetaan kode. Ini bahan untuk `/tiket:rencanakan-tahap`, bukan aturan. Aturan berlaku setelah masuk `docs/PRD.md`.

## Ringkasan tiga permintaan pemilik

1. Semua produk berkategori `DISPLAY PRIA` dan `DISPLAY WANITA` menjadi produk manual.
2. Admin bisa bertindak sebagai operator di gudang aktif mana pun dengan akunnya sendiri, tanpa penugasan.
3. Toko baru tanpa data penjualan memakai rata-rata per kategori hari dari toko acuan yang dipilih admin. Jadwal tetap diatur sendiri di toko baru.

## Keputusan bisnis K1–K12

**Pemilik menerima seluruh rekomendasi di kolom "Rekomendasi" pada 2026-11-04 (percakapan dengan agen).** Perlakukan kolom itu sebagai keputusan pemilik: tulis ke PRD sebagai blok `▶ Keputusan 2026-11-04`, tidak perlu ditanyakan ulang.

| # | Pertanyaan | Rekomendasi | Alasan |
|---|---|---|---|
| K1 | Display dummy (`DD-*`) dan display rework (`-R`) yang berkategori DISPLAY ikut manual? | Ya, ikut. | Permintaan berbunyi "kategori", bukan "kode". Aturan jadi sederhana: kategori DISPLAY PRIA/WANITA = manual. |
| K2 | Draft yang sudah dihitung sebelum aturan baru: dihitung ulang otomatis atau dibiarkan sampai operator menekan Hitung ulang? | Tandai "Perlu dihitung ulang" dengan alasan baru `aturan-produk`. Rencana final lama tidak diubah. | Operator melihat alasannya, tidak ada angka berubah diam-diam. |
| K3 | Pencocokan kategori: persis seperti sekarang, atau abaikan huruf besar dan spasi ganda? | Normalisasi khusus pencocokan: trim, spasi tunggal, huruf besar. | Penulisan `Display Pria` di Excel tidak boleh diam-diam dihitung otomatis. |
| K4 | Admin memegang kelima hak tindakan di semua gudang aktif? | Ya, kelima hak, hanya di gudang aktif. Gudang nonaktif tetap hanya-baca. | Sesuai permintaan "menjadi operator gudang manapun"; aturan gudang nonaktif (T110) tetap. |
| K5 | Nama siapa yang tercatat di riwayat saat admin bertindak? | Nama admin, apa adanya, tanpa penanda khusus. | Kolom pelaku sudah menyimpan user id; tidak perlu kolom baru. |
| K6 | Usulan pengiriman di luar jadwal oleh admin di gudang non-Pusat: langsung aktif atau tetap "menunggu" lalu admin menyetujui sendiri? | Langsung aktif, seperti operator Pusat (OD-06). | Admin adalah pihak yang menyetujui; antrean ke diri sendiri tidak bermakna. |
| K7 | Beranda admin: kartu "Perlu tindakan" per gudang ikut tampil? | Tidak di tahap ini. | Beranda membaca penugasan langsung; menambahnya memperluas scope. Bisa jadi tiket terpisah nanti. |
| K8 | Toko acuan: satu toko untuk keempat kategori hari, atau boleh beda per kategori? | Satu toko acuan untuk semua kategori. | Permintaan menyebut "dari toko mana" (tunggal). Per kategori menambah empat kolom dan form yang rumit. |
| K9 | Toko acuan disimpan di mana: di jadwal tetap toko (ikut versi jadwal) atau di data toko? | Di jadwal tetap toko. | Hitung ulang, riwayat jadwal, Salin jadwal, dan snapshot rencana final ikut otomatis. |
| K10 | Saat toko baru sudah punya data penjualan sendiri di periode sumber: acuan tetap dipakai atau data sendiri yang menang? | Acuan tetap dipakai sampai admin menghapusnya; draft menampilkan catatan "Toko ini sudah punya data penjualan sendiri". | Tidak ada perubahan angka diam-diam; admin yang memutuskan kapan beralih. |
| K11 | Toko acuan boleh dari gudang lain? Boleh toko nonaktif? Boleh berantai (acuan punya acuan)? | Boleh gudang lain. Tidak boleh nonaktif. Tidak boleh berantai. | Rata-rata bersifat global per toko; gudang tidak membatasi. Berantai menyulitkan penjelasan angka. |
| K12 | Varian toko baru = semua varian toko acuan di periode sumber? | Ya. | Toko baru tidak punya baris impor; varian hanya bisa datang dari acuan. |

## Peta kode per fitur

### F1. DISPLAY PRIA / DISPLAY WANITA menjadi produk manual

Titik ubah inti: `src/domain/produk.ts` fungsi `klasifikasiProduk(kode, kategori)`. Tanda tangan sudah menerima kategori, cukup tambah aturan dan alasan baru (misalnya `display`). Aturan `-T` tetap didahulukan.

Dampak lain:
- `src/server/db/schema.ts` CHECK `produk_alasan_manual_sesuai` hanya mengizinkan dua alasan. Perlu migrasi drizzle baru plus UPDATE `produk.klasifikasi`/`alasan_manual` untuk data lama, karena seed memakai `onConflictDoNothing` dan klasifikasi hanya dihitung ulang saat aktivasi impor.
- Label alasan di tinjau impor `src/app/admin/impor/[id]/page.tsx` dan teks bantuan `src/components/teks-bantuan-istilah.ts`.
- Draft lama tidak ditandai "Perlu dihitung ulang" (`URUTAN_ALASAN_HITUNG_ULANG` di `src/server/gudang/dasar-draft.ts`). Lihat K2.
- Golden `tests/golden/klasifikasi-produk.json`: kasus `DP120E-24H`, `DD-GS15-B`, `DD-HAM120-MRF`, `DP120E-ONL-R` berubah menjadi manual; field `aturan` dan `sumber` direvisi.
- Seed: 89 produk DISPLAY, 9 berkode `-T`, jadi 80 produk pindah ke manual (74 → 154 manual).
- UAT: U4.2, U4.6, U4.7, A6.12 angkanya berubah. PRD A6 baris 513–515, A3 baris 105–106, ADR-0007 (supersede dengan ADR baru), GLOSSARY 210–214, DESIGN 169, OPEN-DECISIONS 28 dan 43.

### F2. Admin bertindak sebagai operator

Tidak ada pintu tunggal, tetapi hanya dua fungsi:
- `src/server/gudang/akses.ts` `daftarGudangDapatDilihat`: untuk admin di gudang aktif, kembalikan seluruh `daftarHakTindakan`. Ini otomatis membuka tombol di halaman Pengiriman Gudang, menghapus label hanya-baca, menampilkan menu Kirim di luar jadwal, route ekspor, dan tombol ekspor di Riwayat.
- `src/server/auth/kewenangan.ts` `wajibHakTindakan`: admin lolos bila gudang ada dan aktif. Lebih rapi bila fungsi ini memakai `daftarGudangDapatDilihat`, sehingga aturannya satu.

Risiko: pastikan id gudang 0 atau gudang nonaktif tetap ditolak. Sekitar 20 test unit/integrasi yang menguji "admin tanpa penugasan ditolak" dibalik (daftar di laporan pemetaan: `kewenangan.test.ts`, `page.test.tsx`, `draft.test.tsx`, `final.test.tsx`, `aksi-stok.test.ts`, `usulan-jadwal/*.test.ts`, `ekspor.test.tsx`). E2E tidak terdampak. `gudang-nonaktif.test.tsx` tetap benar.

Dokumen: PRD A3 baris 80 dan 92 (▶ Revisi), GLOSSARY 20, CODING_STANDARDS 26, GUIDE 154, UAT A3.14, OPEN-DECISIONS 63, komentar di modul kewenangan.

### F3. Toko acuan untuk toko tanpa data penjualan

Satu kueri yang memakai rata-rata per toko untuk pengiriman: `hitungBaris` di `src/server/gudang/draft-rencana.ts`. Kueri itu menentukan rata-rata sekaligus varian.

Rencana sisip:
1. Kolom `toko_acuan_id` di `jadwal_toko` (K9), diatur di form Jadwal toko admin dan ikut Salin jadwal. Perubahan acuan = versi jadwal baru, jadi alasan hitung ulang `jadwal` otomatis berlaku.
2. Field `tokoSumberId` di `TokoKirim` (`src/server/gudang/dasar-draft.ts`), diisi dari jadwal aktif.
3. `hitungBaris`: kueri cache memakai `tokoSumberId`, hasil disebar ke setiap toko pengirim yang memakai sumber itu. `tokoId` baris dan parameter kategori efektif tetap toko baru.
4. Snapshot: `tokoDraftRencana` dan `rencanaFinal` mencatat `{id, nama}` toko acuan; tampil di Riwayat dan rincian draft dengan catatan "rata-rata dipinjam dari <toko>". Tautan penelusuran Ringkasan memakai id toko acuan.
5. Fungsi domain murni kecil untuk aturan "acuan atau diri sendiri" supaya bisa diberi golden.

Tidak terdampak: Ringkasan, Kalender, Beranda, ekspor packing list, ekspor Riwayat, buffer (ranking global per keluarga aroma).

Dokumen: PRD A6 ▶ Keputusan 2026-10-09 baris 462–467 (varian dan rata-rata per toko), A5 jadwal tetap, A7 baris 523 (snapshot) dan 535. GLOSSARY entri baru "Toko acuan" (jangan tertukar dengan "Tanggal acuan"). Golden baru untuk toko acuan; catat di `tests/golden/NOTES.md`.

## Usulan irisan tiket (urutan blokir)

| Tiket | Isi | Diblokir oleh |
|---|---|---|
| T145 | Domain: `klasifikasiProduk` kategori DISPLAY → manual (alasan `display`), normalisasi pencocokan; golden direvisi | — |
| T146 | Migrasi CHECK alasan + UPDATE data lama; label tinjau impor dan teks bantuan; alasan hitung ulang `aturan-produk` | T145 |
| T147 | Admin memegang semua hak di gudang aktif: `daftarGudangDapatDilihat` + `wajibHakTindakan`; balik test | — |
| T148 | Usulan di luar jadwal oleh admin langsung aktif (K6) | T147 |
| T149 | Kolom `toko_acuan_id` di jadwal tetap; form Jadwal toko dan Salin jadwal; validasi K11 | — |
| T150 | Draft memakai rata-rata dan varian toko acuan; domain murni + golden; catatan K10 | T149 |
| T151 | Snapshot toko acuan di draft dan rencana final; tampil di Riwayat dan rincian | T150 |

Setiap tiket di bawah 400 baris berubah. T145, T147, T149 bisa jalan paralel.

## Perintah untuk pemilik

```
/tiket:rencanakan-tahap M7 dari docs/input/rencana-m7-bahan.md: (1) semua produk kategori DISPLAY PRIA dan DISPLAY WANITA menjadi produk manual; (2) admin bertindak sebagai operator di gudang aktif mana pun tanpa penugasan; (3) toko acuan pada jadwal tetap untuk toko tanpa data penjualan, rata-rata dan varian dipinjam dari toko acuan. K1–K12 sudah diputuskan pemilik pada 2026-11-04, jawabannya di bahan itu.
```
