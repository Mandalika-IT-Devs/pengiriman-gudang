# Panduan Kerja (otomatis, Claude Code)

Peran Anda: **pemilik produk**. Claude Code mengerjakan, meninjau, dan me-merge tiket sendiri. Anda menjawab pertanyaan bisnis saat diminta dan melakukan UAT di akhir.

Cara memakai aplikasi untuk setiap peran (admin, operator, viewer) ada di bagian akhir: [Memakai aplikasi: panduan per peran](#memakai-aplikasi-panduan-per-peran).

## Menjalankan

1. Nyalakan Docker Desktop. Colokkan laptop ke listrik dan matikan mode tidur otomatis selama berjalan.
2. Di Claude Code (tab Code di Claude Desktop), buka sesi baru di folder repo.
3. Pilih mode izin **Auto** jika tersedia. Jika tidak, pilih **Bypass permissions** ("Menerima semua izin").
4. Ketik: `/jalankan-tiket`
5. Biarkan berjalan. Satu tiket = satu putaran: pelaksana → peninjau → PR → CI → merge.

Jika berhenti karena kuota atau laptop mati: buka sesi baru dan ketik `/jalankan-tiket` lagi. Pekerjaan berlanjut dari keadaan di GitHub.

## Saat berhenti dengan laporan akhir

- **Ada tiket yang diparkir (`needs-info`)**: laporan berisi pertanyaannya. Jawab di sesi Claude Code:

  ```
  Ini jawaban saya sebagai pemilik produk untuk tiket yang diparkir:
  [Txx]: ...
  Catat sebagai keputusan di docs/OPEN-DECISIONS.md (Selesai) dan docs/PRD.md (▶ Keputusan),
  perbarui issue-nya, hapus label needs-info, commit lewat PR dengan label disetujui-pemilik
  (instruksi eksplisit saya), lalu jalankan /jalankan-tiket.
  ```

- **Semua tiket tahap ini tertutup**: rencanakan tahap berikutnya (bagian bawah), lalu jalankan `/jalankan-tiket` lagi.

## Merencanakan tahap berikutnya (interaktif, sekali per tahap)

Ini satu-satunya sesi yang membutuhkan Anda aktif menjawab:

```
/to-tickets Baca docs/PRD.md, docs/OPEN-DECISIONS.md, dan kode yang sudah ada. Buat tiket untuk
SISA seluruh aplikasi (M2 dan M3):
- M2: cache hasil hitung + hitung ulang, halaman Ringkasan (filter, Terapkan, periode aktif),
  penelusuran angka sampai sel, ekspor seluruh hasil filter, kalender, sinkronisasi snapshot libur,
  perubahan kategori, pemetaan keluarga aroma.
- M3: periode sumber gudang, jadwal tetap + pengiriman di luar jadwal + persetujuan, ranking pusat,
  input stok, draft + hitung ulang, finalisasi + snapshot, ekspor rencana.
- Tiket terakhir [T99] Paket UAT lokal: satu perintah `pnpm uat` (docker compose up, migrasi,
  seed admin + 5 gudang + 25 toko), dan docs/UAT.md berisi skenario uji per bagian PRD dalam
  bahasa sederhana. Blocked by semua tiket lain.
Tanyakan saya untuk setiap butir OPEN-DECISIONS yang masih terbuka sebelum membuat tiket yang
bergantung padanya. Setiap tiket memakai format issue yang sudah ada (Dalam scope, Di luar scope,
Kriteria penerimaan, Rujukan, Blocked by) dan label ready-for-agent.
```

## UAT di akhir

Setelah T99 selesai: `pnpm uat`, buka `http://localhost:3100`, lalu ikuti `docs/UAT.md`. Temuan UAT dilaporkan ke Claude Code sebagai tiket perbaikan baru.

## Memakai aplikasi: panduan per peran

Bagian ini menjelaskan cara memakai aplikasi sehari-hari. Teks di antara tanda kutip ("…") adalah teks yang tampil di layar. Aturan lengkapnya ada di `docs/PRD.md`, dan cara mengujinya langkah demi langkah ada di `docs/UAT.md`.

### Peran dan menu

Aplikasi hanya menyimpan dua peran: **Admin** dan **Bukan admin**. Pengguna yang bukan admin menjadi **operator** jika admin menugaskannya ke gudang di **Pengaturan › Penugasan**. Pengguna tanpa penugasan adalah **viewer**. Sidebar dan halaman Pengguna menampilkan perannya sebagai Admin, Operator, atau Viewer. Admin tidak otomatis punya hak operator.

Isi sidebar per peran (kelompok bisa dibuka-tutup):

| Kelompok | Admin | Operator | Viewer |
|---|---|---|---|
| Beranda | Beranda | Beranda | Beranda |
| Riwayat | Riwayat | Riwayat | — |
| Pekerjaan rutin | Impor penjualan, Ranking pusat, Persetujuan jadwal, Pengiriman Gudang | Pengiriman Gudang, Kirim di luar jadwal | — |
| Laporan | Ringkasan, Kalender | Ringkasan, Kalender | Ringkasan, Kalender |
| Data Master | Jadwal toko, Keluarga aroma, Pemetaan produk, Alias nama stok, Libur | — | — |
| Pengaturan | Gudang, Toko, Pengguna, Penugasan | — | — |

Beranda dan Riwayat adalah item tunggal tanpa kelompok; Riwayat tepat di bawah Beranda. Riwayat hanya untuk admin dan operator (pengguna yang punya penugasan di gudang aktif), sama seperti Pengiriman Gudang. "Kirim di luar jadwal" hanya tampil bagi operator yang punya hak "Usulkan pengiriman di luar jadwal" di sedikitnya satu gudang. Operator tanpa hak tindakan apa pun tetap bisa membuka Pengiriman Gudang gudangnya, tetapi hanya-baca.

### Admin

**Pekerjaan rutin bulanan.** Kartu "Mulai di sini" di Beranda berisi empat langkah: Impor penjualan, Terbitkan ranking pusat, Periksa pemetaan produk, dan Setujui pengiriman di luar jadwal. Kartu "Perlu tindakan" di bawahnya menyebut hal yang masih menunggu, misalnya "Usulan pengiriman di luar jadwal menunggu persetujuan".

**Mengelola gudang** (**Pengaturan › Gudang**, halaman "Gudang dan toko"):

- "Tambah gudang": nama wajib diisi dan tidak boleh sama dengan gudang lain.
- Di "Daftar gudang", setiap gudang bisa "Ubah nama", "Nonaktifkan", dan "Aktifkan".
  - Gudang **Pusat** tidak bisa diganti nama atau dinonaktifkan.
  - Gudang hanya bisa dinonaktifkan jika tidak ada lagi toko yang terhubung.
  - Gudang nonaktif tidak muncul di pilihan kerja, dan penugasan operator ke gudang itu tidak lagi memberi akses. Rencana final lamanya tetap bisa dilihat admin.
- "Tambah toko ke gudang": pilih gudang, centang beberapa toko, lalu tekan "Tambahkan toko terpilih". Hasilnya tampil per toko: "Berhasil", "Sudah terhubung", "Nonaktif", atau "Terkait gudang lain". Satu toko hanya boleh terhubung ke satu gudang.
- "Lepas" di baris toko melepas toko dari gudangnya. Dialog konfirmasi menyebut akibatnya: jadwal tetap toko itu dinonaktifkan, dan pengiriman di luar jadwal toko itu yang belum lewat (menunggu atau berlaku) dibatalkan otomatis dengan alasan "Toko dilepas dari gudang". Rencana final lama tidak berubah.
- Memindah toko ke gudang lain = "Lepas", lalu tambahkan ke gudang tujuan, lalu atur lagi jadwal tetapnya.
- "Periode sumber penjualan": bulan penjualan yang dipakai semua operator suatu gudang untuk menghitung kebutuhan.

**Mengelola toko** (**Pengaturan › Toko**):

- "Tambah toko": nama wajib diisi dan unik. Nama harus **sama persis** dengan nama blok toko di sheet penjualan, karena impor mengenali toko dari nama ini. Toko baru belum terhubung ke gudang, tetapi langsung dikenali impor berikutnya.
- "Ubah nama": setelah nama diubah, sheet berikutnya harus memakai nama baru. Penjualan, jadwal, dan rencana final lama tetap melekat ke toko yang sama.
- "Nonaktifkan" dan "Aktifkan": toko nonaktif tidak bisa ditambahkan ke gudang dan tidak ikut masuk draft, walaupun masih punya jadwal tetap. Tidak ada hapus permanen.

**Mengatur jadwal tetap** (**Data Master › Jadwal toko**):

- Pilih gudang. Tabel "Toko terhubung" menampilkan setiap toko gudang itu beserta status toko dan jadwal tetapnya (pola, hari kirim beserta persiapan, siapa dan kapan mengatur).
- "Atur jadwal" di baris toko membuka panel samping "Jadwal tetap <toko>":
  - Pilih Pola: Mingguan, 2× seminggu, 3× seminggu, Dua mingguan, atau 1× sebulan.
  - Centang hari kirim (Senin sampai Minggu), masing-masing dengan persiapan H, H−1, atau H−2. Contoh: kirim Minggu dengan persiapan H−1 berarti persiapan hari Sabtu.
  - Pola Dua mingguan hanya menentukan hari kirim dan persiapannya. Form menampilkan keterangan "Toko dikirim pada hari kirim ini. Operator memilih pekannya di draft, biasanya setiap 2 minggu." Setiap tanggal yang jatuh pada hari kirim itu, setiap pekan, adalah tanggal kirim rutin toko itu (lihat "Toko dua mingguan: Dikirim pekan ini" di bagian Operator).
  - "Simpan jadwal" langsung berlaku, tanpa persetujuan, untuk semua gudang termasuk Pusat.
  - "Nonaktifkan jadwal" meminta konfirmasi lebih dulu.
  - Di bawah form ada "Riwayat jadwal tetap" toko itu, terbaru di atas.
- "Salin jadwal ke beberapa toko" membuka panel untuk menerapkan satu pengaturan langsung ke beberapa toko dalam gudang itu. Hasilnya tampil per toko.
- Perubahan jadwal tetap menandai draft yang terdampak sebagai "Perlu dihitung ulang". Stok yang sudah diisi tidak hilang, dan rencana final tidak berubah.
- Mengubah atau menonaktifkan jadwal tetap bisa membatalkan pengiriman di luar jadwal secara otomatis. Contohnya: tanggal rutin yang dipindah tidak lagi menjadi tanggal kirim rutin, atau tanggal tambahan kini sudah menjadi tanggal kirim rutin. Alasan pembatalannya tercatat di riwayat.

**Menyetujui pengiriman di luar jadwal** (**Pekerjaan rutin › Persetujuan jadwal**):

- "Usulan menunggu" berisi usulan dari operator gudang selain Pusat. Setiap kartu menampilkan toko, gudang, jenis, tanggal kirim beserta persiapannya, pengusul, dan pembandingnya: "Jadwal tetap", "Usulan", dan "Alasan".
- Tekan "Setujui", atau isi "Alasan penolakan" lalu tekan "Tolak". Isi usulan tidak bisa diubah admin.
- "Riwayat keputusan" mencatat semua usulan yang sudah diputuskan, ditarik, atau dibatalkan, terbaru di atas.
  - Pengiriman yang "Berlaku" bisa dibatalkan dengan mengisi "Alasan pembatalan", lalu "Batalkan" dan konfirmasi "Batalkan pengiriman".
  - Pembatalan hanya bisa selama tanggal kirimnya belum lewat dan toko itu belum punya rencana final untuk tanggal tersebut.
  - Membatalkan jenis Pindah mengembalikan tanggal rutinnya.

**Mengelola pengguna** (**Pengaturan › Pengguna**):

- "Buat pengguna": nama, email, kata sandi (minimal 8 karakter), dan peran ("Admin" atau "Bukan admin"). Tidak ada pendaftaran mandiri.
- Kolom "Kata sandi" di "Daftar pengguna":
  - Akun bukan admin (Operator dan Viewer): kata sandi terbaru tersembunyi ("••••••••"). Tekan "Tampilkan" untuk melihatnya dan "Sembunyikan" untuk menutupnya lagi. Kata sandi terbaru adalah yang terakhir diisi, yaitu saat akun dibuat atau saat kata sandinya diatur ulang.
  - "Belum tersedia": kata sandi diisi sebelum fitur ini, misalnya akun dari `pnpm uat`, sehingga hanya tersimpan sebagai hash satu arah. Kata sandinya tersedia setelah pengguna menggantinya atau admin mengatur ulang.
  - "—": akun admin. Kata sandi admin tidak pernah ditampilkan dan tidak disimpan dalam bentuk yang bisa dibaca. Mengubah akun bukan admin menjadi admin menghapus salinan kata sandinya.
  - Di bawahnya tertulis "Diubah <tanggal> oleh <nama>", yaitu kapan dan oleh siapa kata sandi terakhir diisi. Untuk kata sandi yang diisi sebelum fitur ini tertulis "—".
  - Salinan kata sandi disimpan terenkripsi. Kuncinya tidak ikut backup database.
- "Atur ulang kata sandi" mengisi kata sandi baru untuk akun lain, tanpa perlu mengetahui kata sandi lamanya. Tombol ini tidak ada di baris akun Anda sendiri.
  - Isi "Kata sandi baru" dan "Ulangi kata sandi baru" (minimal 8 karakter, keduanya harus sama), lalu tekan "Simpan kata sandi". Tombol mata di kanan setiap isian menampilkan atau menyembunyikan ketikan.
  - Akun itu keluar dari semua perangkat dan harus masuk lagi dengan kata sandi baru. Sampaikan kata sandi baru kepada penggunanya.
- Peran diubah dengan pilihan peran lalu "Simpan peran". Aplikasi selalu harus punya minimal satu admin aktif. "Nonaktifkan" (tidak ada di baris akun sendiri) dan "Aktifkan kembali" meminta konfirmasi lebih dulu.

**Penugasan** (**Pengaturan › Penugasan**): tugaskan operator ke gudang dengan hak tindakan "Usulkan pengiriman di luar jadwal", "Input stok", "Hitung kebutuhan", "Finalisasi", dan "Ekspor". Penugasan tanpa hak memberi akses hanya-baca.

Admin bisa membuka halaman Pengiriman Gudang semua gudang, tetapi **hanya-baca**. Menghitung, mengisi stok, dan memfinalisasi adalah pekerjaan operator.

### Operator

**Mulai dari Beranda.** Kartu "Mulai di sini" menyebut gudang dan tanggal kirim terdekat beserta tiga langkah: "Hitung kebutuhan", "Isi stok", dan "Finalisasi". Setiap tombol membuka halaman gudang pada tanggal itu.

**Halaman Pengiriman Gudang.** Operator yang hanya ditugaskan di satu gudang langsung masuk ke halaman gudangnya. Urutan isinya:

1. Kepala halaman: nama gudang dan ringkasan periode sumber. Rencana final yang sudah tersimpan dilihat lewat menu **Riwayat**.
2. **Draft rencana.** Halaman membuka tanggal kirim terdekat. Chip tanggal draft diurutkan dari yang terdekat. Form "Hitung kebutuhan" menampilkan saran tanggal kirim untuk 14 hari ke depan, dan tanggal lain tetap bisa diketik.
3. **Jadwal toko** (awalnya tertutup, tekan judulnya untuk membuka): jadwal tetap setiap toko beserta status toko, ditambah kolom "Di luar jadwal (akan datang)". Operator hanya bisa melihat. Jadwal tetap diatur admin.
4. **Periode sumber penjualan** (awalnya tertutup): bulan yang ditetapkan admin, hanya-baca.

**Kirim di luar jadwal** (**Pekerjaan rutin › Kirim di luar jadwal**, atau tautan "Kirim di luar jadwal" di bawah tabel Jadwal toko):

- Di gudang selain Pusat halamannya berjudul "Usulkan pengiriman di luar jadwal — <gudang>" dan usulan menunggu persetujuan admin. Di Pusat judulnya "Atur pengiriman di luar jadwal — Pusat" dan pengiriman langsung berlaku. Jadwal tetap toko tidak berubah.
- Isi Toko (hanya toko yang punya jadwal tetap aktif), lalu Jenis:
  - **Tambahan (pengiriman rutin tetap berjalan):** tanggal kirim tambahan. Contoh: BOTANI rutin Senin dan Kamis, ada kebutuhan mendesak hari Selasa.
  - **Pindah (satu tanggal rutin dipindah):** pilih "Tanggal rutin yang dipindah" dari tanggal kirim rutin toko itu yang akan datang. Persiapan awalnya mengikuti tanggal rutin itu. Tanggal rutin itu tidak lagi menjadi tanggal kirim.
- Isi Tanggal kirim, Persiapan (H, H−1, H−2), dan **Alasan** (wajib). Lalu tekan "Kirim usulan", atau "Simpan" di Pusat.
- Syaratnya diperiksa saat diusulkan dan diperiksa ulang saat disetujui:
  - Tanggal kirim hari ini atau sesudahnya, dan belum menjadi tanggal kirim toko itu.
  - Untuk Pindah, tanggal rutinnya belum lewat, belum dipindah, dan belum punya rencana final.
  - Jika syarat gagal, pesan "Syarat tidak terpenuhi: …" menyebut syarat mana yang gagal.
  - Satu toko boleh punya beberapa usulan sekaligus, asalkan tanggalnya berbeda.
- Di bawah form, daftar "Perlu tindakan" (terbaru di atas) hanya berisi entri yang masih bisa ditindak di halaman ini:
  - Usulan berstatus Menunggu. Pengusulnya bisa menekan "Tarik"; entri usulan orang lain menampilkan "—".
  - Di Pusat, pengiriman berlaku yang tanggal kirimnya belum lewat dan belum punya rencana final. Operator berhak bisa membatalkannya dengan alasan. Di gudang lain pembatalan dilakukan admin.
  - Jika kosong, tampil "Tidak ada pengiriman di luar jadwal yang perlu ditindak." beserta tautan ke menu Riwayat.
- Catatan lengkap semua pengiriman di luar jadwal (Menunggu, Berlaku, Ditolak, Ditarik, Dibatalkan) ada di menu **Riwayat**, tab "Di luar jadwal".

**Membaca penanda di draft.** Pengiriman di luar jadwal yang berlaku ikut perhitungan seperti pengiriman biasa:

- Toko yang dikirim di luar jadwal diberi penanda "Di luar jadwal · Tambahan" atau "Di luar jadwal · Pindahan dari <hari, tanggal>". Di bawahnya tampil "Alasan: … · Disetujui <admin>, <waktu>", atau "Langsung berlaku (Pusat)". Penanda yang sama tersimpan di rencana final dan riwayatnya, dan ekspor `.xlsx` punya baris keterangan "Jenis pengiriman".
- Pengiriman tambahan **memendekkan cakupan** pengiriman sebelumnya toko itu, karena cakupan selalu berakhir sehari sebelum kiriman berikutnya. Contoh BOTANI (Senin H, Kamis H−1) dengan tambahan Selasa H−1: cakupan Senin menjadi Senin saja, dan cakupan Selasa adalah Senin–Rabu.
- Pengecualian: setiap pengiriman toko dua mingguan, rutin maupun di luar jadwal, selalu mencakup 14 hari (ditambah hari persiapan), kapan pun kiriman berikutnya. Pengiriman di luar jadwal tidak memendekkan cakupan pengiriman dua mingguan sebelumnya.
- Jika hari persiapan jatuh sebelum kiriman sebelumnya sampai, tampil peringatan "Kiriman <hari, tanggal> belum sampai saat persiapan. Pastikan jumlahnya ikut dihitung di stok akhir." Peringatan ini tidak menahan finalisasi.
- Saat pengiriman di luar jadwal mulai berlaku atau dibatalkan, draft yang terdampak bertanda "Perlu dihitung ulang" ("Yang berubah: Jadwal toko"). Tekan "Hitung ulang". Stok yang sudah diisi tetap ada. Toko yang tanggal rutinnya dipindah dikeluarkan dari draft tanggal itu, dengan keterangan "Toko … dikeluarkan dari draft karena tidak lagi mengirim pada tanggal ini menurut jadwal aktif."

**Toko dua mingguan: Dikirim pekan ini.** Setelah "Buka toko", toko berpola dua mingguan pada tanggal kirim rutinnya menampilkan pilihan **"Dikirim pekan ini"** di bawah teks cakupan: "Dikirim" atau "Tidak dikirim pekan ini".

- Di sampingnya tampil kirim terakhir toko itu, misalnya "Kirim terakhir: Rabu, 21-10-2026 (7 hari sebelumnya)", atau "Belum ada rencana final sebelumnya". Kirim terakhir adalah tanggal kirim rencana final terakhir toko itu sebelum tanggal draft, dari gudang mana pun dan jenis pengiriman apa pun.
- Nilai awalnya otomatis. "Dikirim" jika belum ada rencana final sebelumnya atau kirim terakhirnya 14 hari atau lebih sebelumnya; selain itu "Tidak dikirim pekan ini". Nilai awal mengikuti rencana final terbaru, kecuali operator sudah memilih sendiri.
- Di bawahnya tertulis asal nilainya: "Otomatis dari kirim terakhir, belum dipilih operator.", atau "Dipilih <nama> pada <tanggal>".
- Operator yang punya hak Finalisasi di gudang itu bisa mengubahnya: pilih salah satu, lalu tekan "Simpan pilihan". Pilihan tetap berlaku walaupun draft dihitung ulang. Admin, viewer, dan operator tanpa hak Finalisasi hanya melihatnya.
- Toko "Tidak dikirim pekan ini" diberi penanda "Tidak dikirim pekan ini" di "Ringkasan per toko" dan di kepala toko.
  - Kebutuhan dan jumlah kirimnya tetap tampil, dan stok tetap bisa diisi.
  - Toko itu tidak bisa difinalisasi. Di kepala toko tampil "Belum bisa difinalisasi: toko ini Tidak dikirim pekan ini. Ubah pilihan menjadi Dikirim untuk memfinalisasinya."
  - Toko itu tidak dihitung sebagai toko yang belum final atau sebagai baris tertahan di kartu gudang Pengiriman Gudang, kartu "Perlu tindakan", dan "Mulai di sini".
- Toko yang sudah final untuk tanggal itu selalu "Dikirim" dan pilihannya tidak bisa diubah. Pengiriman di luar jadwal toko dua mingguan tidak punya pilihan ini, karena selalu dikirim. Toko pola lain juga tidak.
- Setiap tanggal yang jatuh pada hari kirim toko dua mingguan adalah tanggal kirim rutinnya, jadi pilihan ini muncul setiap pekan. Contoh: BXC (Rabu, H−1) pada Rabu 21-10, 28-10, 04-11-2026, dan seterusnya. Teks cakupannya selalu menyebut dua minggu, misalnya "Cakupan 15 hari: persiapan 1 hari + 14 hari (dua minggu)".

**Mengisi stok.** Tekan "Buka toko" di "Ringkasan per toko".

- Kepala toko tetap terlihat saat tabel digulir. Isinya nama toko, status, jumlah baris tertahan, dan tombol Finalisasi (atau alasan belum bisa difinalisasi).
- Tabel varian menggulir di dalam kotaknya sendiri. Judul kolom tetap di atas, dan kolom kode serta nama produk tetap di kiri saat tabel digeser.
- Filter di atas tabel: "Semua", "Tertahan", "Stok kosong", dan "Jumlah kirim > 0", masing-masing dengan jumlahnya. Ada juga kotak "Cari kode atau nama produk".
  - Filter hanya menyaring tampilan. Isian di baris yang sedang tersembunyi tetap ikut tersimpan.
  - "Isi 0" dan aturan finalisasi tetap berlaku untuk seluruh toko.
  - Tautan "Tampilkan baris tertahan" di samping "Belum bisa difinalisasi: …" langsung memasang filter Tertahan.
- Isi stok dengan "Unggah file stok" (file dari kasir) atau ketik langsung. "Isi 0 untuk N stok yang kosong" hanya mengisi produk otomatis yang masih kosong.
- Bar di bawah layar selalu terlihat. Isinya status simpan (misalnya "Ada perubahan yang belum disimpan"), jumlah isian yang berubah, dan tombol "Simpan stok".
- Jika Anda meninggalkan halaman dengan isian yang belum disimpan, browser bertanya dulu.

**Panel rincian.** "Lihat rincian" di baris produk membuka panel "Rincian perhitungan <kode> · <toko>" dari kanan:

- Isinya tanggal cakupan dengan kategori efektifnya, rata-rata per kategori (bisa diklik untuk ditelusuri di Ringkasan), kebutuhan, buffer, stok akhir, dan jumlah kirim. Teks cakupan ditulis lengkap, misalnya "Cakupan 8 hari: persiapan 1 hari + 7 hari sampai sebelum kiriman berikutnya".
- Membuka panel tidak memuat ulang halaman. Isian stok yang belum disimpan tetap ada, dan posisi gulir tabel tidak berubah.
- Tutup panel dengan "Tutup", tombol Esc, atau klik di luar panel. Alamat halaman saat panel terbuka bisa dibagikan, dan akan langsung membuka panel yang sama.

**Finalisasi dan ekspor.**

- Setelah tidak ada baris tertahan, tekan "Finalisasi rencana". Dialog konfirmasi meringkas toko, tanggal kirim, jumlah varian, total jumlah kirim, dan peringatan yang masih tampil.
- Toko dua mingguan yang "Tidak dikirim pekan ini" tidak punya tombol finalisasi. Ubah pilihannya menjadi "Dikirim" lebih dulu (lihat "Toko dua mingguan: Dikirim pekan ini" di atas).
- Finalisasi ulang membutuhkan alasan dan menghasilkan versi baru. Versi lama tetap ada di menu **Riwayat**, tab "Rencana final".
- Finalisasi hanya menyimpan rencana kebutuhan barang, bukan konfirmasi pengiriman fisik.
- "Ekspor (.xlsx)" tersedia di rencana final bagi operator yang punya hak Ekspor di gudang rencana itu.
- File ekspor langsung bisa dipakai gudang sebagai packing list. Isinya satu sheet "Rencana final": di atas ada Gudang, Tanggal kirim, Toko, Jenis pengiriman, dan Waktu finalisasi, lalu tabel Kode produk, Nama produk, Kebutuhan barang, Stok akhir, Buffer (%), Status, Jumlah kirim, dan Keterangan. Kolom Keterangan dibiarkan kosong untuk catatan tim gudang. Tanda "—" berarti tidak tersedia, bukan 0. Periode sumber, impor sumber, dan ranking tidak ditulis di file; lihat di rincian rencana final.

**Riwayat** (menu **Riwayat**, tepat di bawah Beranda). Isinya mengikuti penugasan:

- **Admin** melihat riwayat **semua gudang**, termasuk gudang nonaktif (bertanda "Nonaktif").
- **Operator** hanya melihat riwayat gudang yang juga bisa ia buka di Pengiriman Gudang: gudang aktif tempat ia ditugaskan, termasuk penugasan tanpa hak tindakan. Penugasan ke gudang nonaktif tidak memberi akses. Pilihan filter Gudang hanya berisi gudang itu, dan pilihan Toko hanya toko yang punya riwayat di sana. Rincian rencana final gudang lain yang dibuka lewat alamatnya menampilkan halaman tidak ditemukan.
- Agar seseorang bisa melihat riwayat suatu gudang tanpa bisa bertindak, admin memberinya penugasan di gudang itu tanpa hak tindakan.

Tab "Rencana final" berisi semua versi rencana final dari gudang yang bisa Anda lihat:

- Kolom: Tanggal kirim, Gudang, Toko (dengan penanda di luar jadwal), Versi, Status (versi lama berlabel "Digantikan oleh versi n"), Difinalisasi oleh, dan Waktu finalisasi.
- Filter Gudang, Toko, serta "Tanggal kirim dari" dan "Tanggal kirim sampai" baru berlaku setelah "Terapkan". Tanggal yang dikosongkan berarti tidak dibatasi. Ada juga "Cari toko", dan daftar dibagi per 50 baris.
- "Lihat rincian" membuka rincian rencana final. Tombol "Ekspor (.xlsx)" di baris dan di rincian hanya tampil bagi pengguna yang punya hak Ekspor di gudang rencana itu.
- Alamat lama riwayat di bawah Pengiriman Gudang otomatis dialihkan ke halaman ini.

**Ekspor dari Riwayat.** Tombol "Ekspor (.xlsx)" di atas tabel mengekspor tab yang sedang dibuka untuk **seluruh hasil filter** yang diterapkan (termasuk "Cari toko"), bukan hanya 50 baris yang terlihat. Hasilnya satu file dengan satu sheet.

1. Buka menu **Riwayat** dan pilih tab "Rencana final" atau "Di luar jadwal".
2. Atur filter Gudang, Toko, rentang tanggal kirim, dan Cari toko, lalu tekan "Terapkan".
3. Tekan "Ekspor (.xlsx)". File `riwayat-rencana-final-<tanggal>.xlsx` atau `riwayat-di-luar-jadwal-<tanggal>.xlsx` terunduh.

- Di atas tabel file ada baris keterangan: jenis riwayat, filter yang diterapkan, waktu ekspor, dan arti tanda "—" (tidak tersedia, bukan 0).
- Tab "Rencana final" berisi satu baris per produk per rencana final, termasuk versi yang sudah digantikan. Kolom: Gudang, Tanggal kirim, Toko, Versi, Berlaku ("Ya" atau "Digantikan oleh versi n"), Jenis pengiriman, Difinalisasi oleh, Waktu finalisasi, Kode produk, Nama produk, Kebutuhan barang, Stok akhir, Buffer (%), Jumlah kirim, Status. Angkanya dari snapshot masing-masing rencana final.
- Tab "Di luar jadwal" berisi satu baris per pengiriman. Kolom: Gudang, Jenis, Toko, Tanggal kirim, Persiapan, Tanggal rutin yang dipindah, Alasan, Status, Pengusul, Waktu usul, Penyetuju/penolak, Waktu keputusan, Alasan penolakan, Ditarik/dibatalkan oleh, Waktu penarikan/pembatalan, Alasan penarikan/pembatalan.
- **Admin** mengekspor riwayat semua gudang, tanpa perlu penugasan.
- **Operator** hanya mengekspor baris dari gudang tempat ia punya hak Ekspor. Jika hasil filter memuat gudang penugasannya yang tanpa hak Ekspor, halaman menyebutnya sebelum ekspor, misalnya "Gudang Cibubur tidak ikut diekspor karena Anda tidak punya hak ekspor di sana." Gudang di luar penugasannya tidak pernah disebut, karena riwayatnya memang tidak terlihat.
- Operator tanpa hak Ekspor di gudang mana pun tidak melihat tombol ini.

Tab "Di luar jadwal" berisi semua pengiriman di luar jadwal dari gudang yang bisa Anda lihat (admin: semua gudang), dengan semua status, terbaru di atas. Tab ini hanya-baca: Tarik dan Batalkan tetap di halaman Kirim di luar jadwal dan Persetujuan jadwal.

- Kolom: Toko, Gudang (gudang nonaktif bertanda "Nonaktif"), Status, Jenis (Tambahan, atau "Pindahan dari <hari, tanggal>"), Tanggal kirim (persiapan), Alasan, Diusulkan (siapa dan kapan), Diputuskan (penyetuju atau penolak dan kapan, atau "Langsung berlaku (Pusat)"), dan Keterangan (alasan penolakan, penarikan, atau pembatalan beserta siapa dan kapan).
- Filter Gudang, Toko, dan rentang tanggal kirim sama dengan tab Rencana final dan baru berlaku setelah "Terapkan". Rentang tanggal memakai tanggal kirim pengiriman itu. Ada juga "Cari toko", dan daftar dibagi per 50 baris.

### Viewer

Viewer melihat **Beranda**, **Ringkasan**, dan **Kalender** untuk semua toko, dan bisa mengekspor hasil Ringkasan. Viewer tidak melihat Riwayat, Pengiriman Gudang, dan menu admin. Membuka alamat `/riwayat` menampilkan halaman tidak ditemukan. Jika seorang viewer perlu melihat riwayat suatu gudang, admin menugaskannya ke gudang itu tanpa hak tindakan; ia lalu menjadi operator hanya-baca untuk gudang tersebut.
