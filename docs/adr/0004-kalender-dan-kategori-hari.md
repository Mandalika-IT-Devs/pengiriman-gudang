# Kalender laporan berbasis tanggal acuan; kategori efektif tidak memindahkan posisi

Status: accepted (2026-10-08) — keputusan pemilik, aturan lengkap di PRD Bagian B

Bulan dan minggu laporan suatu tanggal ditentukan oleh **tanggal acuan**. Untuk Senin–Kamis, tanggal acuannya adalah Kamis di minggu yang sama. Untuk Jumat, Sabtu, dan Minggu, tanggal acuannya adalah tanggal itu sendiri. Minggu laporan = ⌈tanggal acuan / 7⌉. Ini bukan ISO week dan bukan baris kisi kalender. Posisi bulan dan minggu selalu dihitung dari **kategori dasar** tanggal asli. Perubahan kategori manual hanya mengganti **kategori efektif**.

Informasi libur dari API pihak ketiga hanya menjadi snapshot tahunan yang perlu disetujui admin. Informasi itu tidak pernah mengubah kategori, jadwal, atau cakupan secara otomatis. Persetujuan snapshot libur, perubahan kategori manual, dan persetujuan jadwal adalah tiga alur yang terpisah.
