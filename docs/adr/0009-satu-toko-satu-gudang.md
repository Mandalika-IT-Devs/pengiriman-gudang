# Satu toko terhubung ke paling banyak satu gudang

Status: accepted (2026-10-09) — keputusan pemilik (OD-03)

Sebuah toko boleh belum terhubung ke gudang mana pun, tetapi tidak boleh terhubung ke lebih dari satu gudang. Aturan ini ditegakkan di server dan database (hubungan toko–gudang unik per toko), bukan hanya di tampilan. Upaya menghubungkan toko yang sudah terkait gudang lain ditolak dengan keterangan yang jelas, dan pada tambah toko massal hasilnya tampil per toko. Keputusan ini sulit dibalik karena model data satu-ke-banyak berbeda dengan banyak-ke-banyak, dan rencana kirim per gudang bergantung padanya.
