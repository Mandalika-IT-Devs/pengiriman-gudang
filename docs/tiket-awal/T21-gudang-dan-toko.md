# [T21] Gudang, master toko, dan tambah toko massal
<!-- labels: ready-for-agent,M1,pelaksana:B -->

## Yang dibangun
Admin mengelola lima gudang dan master toko, lalu menghubungkan beberapa toko ke satu gudang dengan satu tombol. Hasilnya ditampilkan per toko.

## Dalam scope
- Tabel gudang (lima baris: Pusat, Gudang Bali, Gudang Bandung, Gudang Cibubur, Gudang Jabodetabek) dan master toko (nama sesuai blok sheet, status aktif/nonaktif).
- Seed 25 toko dari daftar: PMS, PMJ, QUEEN, LWB, DMB, MKS, DPM, PVJ, PASKAL, DELTAMAS, KUNCIT, BXC, SMB, KOKAS, PMB, BSD, TSM CBB, SMS, KARAWACI, BOTANI, CCM, ALSUT, SENTUL, MKG, LMK.
- Tambah toko massal: pilih banyak toko → satu tombol → hasil per toko (berhasil / sudah terhubung / nonaktif / terkait gudang lain), dengan keterangan jelas. Tidak diulang otomatis bila hasilnya belum pasti.
- Satu toko terhubung ke paling banyak satu gudang, ditegakkan di server dan database (OD-03, ADR-0009).
- Hanya admin (server).

## Di luar scope
Penugasan operator, jadwal, dan periode sumber.

## Kriteria penerimaan
- [ ] Menghubungkan toko yang sudah terkait gudang lain ditolak (test).
- [ ] Pemetaan toko ke gudang (OD-12) menyusul sebagai data dari pemilik; tidak ada hubungan yang di-seed dengan menebak.
- [ ] Tambah massal dengan campuran status menampilkan hasil per toko (test).
- [ ] Non-admin ditolak di server (test).
- [ ] `pnpm verify` hijau.

## Rujukan
PRD A3; ADR-0009; OD-02 (nama), OD-03; OD-12 (data menyusul)

## Blocked by
- [T20]

## Pelaksana
B (Claude Code)
