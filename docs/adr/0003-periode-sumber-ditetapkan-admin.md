# Periode sumber penjualan gudang ditetapkan admin, satu per gudang

Status: accepted (2026-10-08) — keputusan pemilik

Admin menetapkan satu periode sumber penjualan (1–12 bulan) untuk setiap gudang. Semua operator di gudang itu memakainya. Server membaca periode ini setiap kali menghitung; operator tidak punya kontrol untuk mengubahnya dan melihatnya hanya-baca, lengkap dengan siapa yang menetapkan dan kapan. Periode ini terpisah dari filter Ringkasan. Jika admin mengubahnya, draft rencana di gudang tersebut ditandai perlu dihitung ulang. Stok tetap dipertahankan, dan rencana final tidak berubah. Jika periode belum ditetapkan, perhitungan tidak berjalan dan pesan "Periode sumber belum ditetapkan admin" tampil. Sistem tidak memilih periode cadangan sendiri.
