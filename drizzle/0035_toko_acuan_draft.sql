-- T151 (PRD A5 ▶ Keputusan 2026-11-04, toko acuan: Perhitungan dan Tampilan): draft menyimpan toko acuan yang menjadi
-- sumber varian dan rata-rata toko itu, dan apakah toko itu sudah punya data penjualan sendiri di periode sumber (catatan
-- di kepala toko). Draft yang sudah ada dihitung tanpa toko acuan.
ALTER TABLE "toko_draft_rencana" ADD COLUMN "toko_acuan_id" integer;--> statement-breakpoint
ALTER TABLE "toko_draft_rencana" ADD COLUMN "catatan_data_sendiri" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "toko_draft_rencana" ADD CONSTRAINT "toko_draft_rencana_toko_acuan_id_toko_id_fk" FOREIGN KEY ("toko_acuan_id") REFERENCES "public"."toko"("id") ON DELETE no action ON UPDATE no action;