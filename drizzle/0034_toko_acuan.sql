-- T149 (PRD A5 ▶ Keputusan 2026-11-04, toko acuan: Perubahan dan peralihan): toko acuan pada jadwal tetap, boleh kosong.
-- Semua jadwal tetap yang sudah ada tanpa toko acuan.
ALTER TABLE "jadwal_toko" ADD COLUMN "toko_acuan_id" integer;--> statement-breakpoint
ALTER TABLE "jadwal_toko" ADD CONSTRAINT "jadwal_toko_toko_acuan_id_toko_id_fk" FOREIGN KEY ("toko_acuan_id") REFERENCES "public"."toko"("id") ON DELETE no action ON UPDATE no action;