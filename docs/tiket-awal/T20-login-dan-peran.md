# [T20] Login dan peran (admin, viewer) dengan pemeriksaan di server
<!-- labels: ready-for-agent,M1,pelaksana:B -->

## Yang dibangun
Pengguna bisa masuk dengan email dan kata sandi. Akun dibuat oleh admin. Halaman dan aksi diproteksi di server menurut peran.

## Dalam scope
- Better Auth (email + kata sandi) dengan adapter Drizzle. Tidak ada pendaftaran mandiri.
- Peran global: `admin` dan `viewer`. Status operator **bukan** peran global; status itu datang dari penugasan gudang (T22).
- Helper server `wajibMasuk()` dan `wajibAdmin()`, dipakai di setiap server action atau route yang dibuat tiket ini.
- Halaman admin sederhana: daftar pengguna, buat pengguna, ubah peran, nonaktifkan.
- Skrip seed untuk admin pertama dari env var.

## Di luar scope
Penugasan gudang, hak tindakan, cakupan laporan viewer (OD-07), lupa kata sandi, dan SSO.

## Kriteria penerimaan
- [ ] Pengguna yang belum masuk diarahkan ke halaman masuk.
- [ ] Viewer yang memanggil aksi admin langsung (tanpa UI) ditolak (test server).
- [ ] Admin bisa membuat pengguna; form menampilkan keadaan simpan sesuai CODING_STANDARDS.
- [ ] `pnpm verify` hijau. Dependency Better Auth disetujui pemilik.

## Rujukan
PRD A3; ADR-0001; CODING_STANDARDS "Kewenangan"

## Blocked by
- [T00]

## Pelaksana
B (Claude Code)
