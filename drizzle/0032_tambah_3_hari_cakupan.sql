-- T143 (PRD A5 ▶ Keputusan 2026-10-27, Perubahan dan peralihan): tanda "Tambah 3 hari cakupan" pada jadwal tetap toko.
-- Semua jadwal tetap yang sudah ada menjadi tidak dicentang. Draft menyimpan tanda yang dipakai saat dihitung; draft yang
-- sudah ada dihitung tanpa tanda.
ALTER TABLE "jadwal_toko" ADD COLUMN "tambah_3_hari_cakupan" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "toko_draft_rencana" ADD COLUMN "tambah_3_hari_cakupan" boolean DEFAULT false NOT NULL;
