# [T21] Gudang, master toko, dan tambah toko massal
<!-- labels: ready-for-agent,M1,pelaksana:B -->

## Yang dibangun
Admin mengelola lima gudang dan master toko, lalu menghubungkan beberapa toko ke satu gudang dengan satu tombol. Hasilnya ditampilkan per toko.

## Dalam scope
- Tabel gudang (lima baris; nama dari OD-02) dan master toko (nama sesuai blok sheet, status aktif/nonaktif).
- Seed 25 toko dari daftar: PMS, PMJ, QUEEN, LWB, DMB, MKS, DPM, PVJ, PASKAL, DELTAMAS, KUNCIT, BXC, SMB, KOKAS, PMB, BSD, TSM CBB, SMS, KARAWACI, BOTANI, CCM, ALSUT, SENTUL, MKG, LMK.
- Tambah toko massal: pilih banyak toko → satu tombol → hasil per toko (berhasil / sudah terhubung / nonaktif / terkait gudang lain), dengan keterangan jelas. Tidak diulang otomatis bila hasilnya belum pasti.
- Hanya admin (server).

## Di luar scope
Penugasan operator, jadwal, dan periode sumber.

## Kriteria penerimaan
- [ ] OD-02 dan OD-03 sudah diputuskan pemilik sebelum tiket dimulai. Jika belum: berhenti dan beri label `needs-info`.
- [ ] Tambah massal dengan campuran status menampilkan hasil per toko (test).
- [ ] Non-admin ditolak di server (test).
- [ ] `pnpm verify` hijau.

## Rujukan
PRD A3; OD-02, OD-03

## Blocked by
- [T20]

## Pelaksana
B (Claude Code)
