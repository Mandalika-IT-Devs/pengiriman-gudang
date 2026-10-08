# [T22] Penugasan operator ke gudang dan hak tindakan
<!-- labels: ready-for-agent,M1,pelaksana:B -->

## Yang dibangun
Admin menugaskan pengguna sebagai operator di gudang tertentu dan memilih hak tindakannya. Server punya satu helper untuk memeriksa hak tindakan.

## Dalam scope
- Tabel penugasan (pengguna, gudang, daftar hak tindakan). Hak tindakan diambil dari PRD A3: `kelola-usulan-jadwal`, `input-stok`, `hitung-kebutuhan`, `finalisasi`, `ekspor`.
- Helper server `wajibHakTindakan(gudang, tindakan)`. Admin tanpa penugasan **tidak** lolos.
- Halaman admin untuk mengelola penugasan, dengan keadaan simpan sesuai CODING_STANDARDS.

## Di luar scope
Fitur yang memakai hak tindakan (jadwal, stok, finalisasi).

## Kriteria penerimaan
- [ ] Test: admin tanpa penugasan ditolak `wajibHakTindakan`; operator dengan hak `input-stok` di gudang X lolos untuk X dan ditolak untuk gudang Y.
- [ ] `pnpm verify` hijau.

## Rujukan
PRD A3; CONTEXT.md (Admin, Operator, Hak tindakan)

## Blocked by
- [T21]

## Pelaksana
B (Claude Code)
