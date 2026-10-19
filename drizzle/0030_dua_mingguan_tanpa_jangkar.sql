ALTER TABLE "jadwal_toko" DROP CONSTRAINT "jadwal_toko_jangkar_dua_mingguan";--> statement-breakpoint
-- T135 (PRD A5 ▶ Revisi 2026-10-19, Peralihan): pola dua mingguan tanpa tanggal jangkar; setiap hari kirimnya kini tanggal
-- kirim rutin setiap pekan. Pembatalan otomatis satu kali untuk pengiriman di luar jadwal toko yang jadwal tetap aktifnya
-- dua mingguan, yang masih menunggu atau berlaku, tanggal kirimnya jatuh pada salah satu hari kirimnya, belum lewat (WIB),
-- dan belum punya rencana final toko itu untuk tanggal itu. Pembatal kosong = sistem, sama seperti pembatalan otomatis
-- T113. Kolom dan data tanggal jangkar lama tetap ada; usulan_jadwal tidak disentuh.
UPDATE "pengiriman_di_luar_jadwal" AS "p"
SET "status" = 'dibatalkan', "alasan_pembatalan" = 'Tanggal itu sudah menjadi tanggal kirim rutin', "dibatalkan_pada" = now()
WHERE "p"."status" IN ('menunggu', 'berlaku')
  AND "p"."tanggal_kirim" >= (now() AT TIME ZONE 'Asia/Jakarta')::date
  AND EXISTS (
    SELECT 1 FROM "jadwal_toko" AS "j"
    WHERE "j"."toko_id" = "p"."toko_id"
      AND "j"."status" = 'aktif'
      AND "j"."pola" = 'dua-mingguan'
      AND "j"."hari_kirim" @> jsonb_build_array(jsonb_build_object(
        'hari', (ARRAY['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'])[extract(isodow FROM "p"."tanggal_kirim")::int]
      ))
  )
  AND NOT EXISTS (
    SELECT 1 FROM "rencana_final" AS "r" WHERE "r"."toko_id" = "p"."toko_id" AND "r"."tanggal_kirim" = "p"."tanggal_kirim"
  );
