-- T145 (PRD A6 ▶ Keputusan 2026-11-04, ADR-0012): produk berkategori DISPLAY PRIA/DISPLAY WANITA menjadi produk manual
-- dengan alasan baru 'display'.
ALTER TABLE "produk" DROP CONSTRAINT "produk_alasan_manual_sesuai";--> statement-breakpoint
ALTER TABLE "produk" ADD CONSTRAINT "produk_alasan_manual_sesuai" CHECK (("produk"."klasifikasi" = 'manual' and "produk"."alasan_manual" in ('display-tester', 'kertas-tester', 'display')) or ("produk"."klasifikasi" = 'otomatis' and "produk"."alasan_manual" is null));--> statement-breakpoint
-- Klasifikasi master produk dihitung ulang satu kali dengan aturan klasifikasiProduk (src/domain/produk.ts), diperiksa
-- berurutan: (1) kode berakhiran -T → display-tester; (2) kategori KTP/KTL persis → kertas-tester; (3) kategori
-- DISPLAY PRIA/DISPLAY WANITA setelah normalisasi → display; selain itu otomatis. Normalisasi sama dengan normalisasiAlias:
-- setiap deret spasi (kelas \s JavaScript, termasuk tab, baris baru, dan spasi tak terputus) menjadi satu spasi, spasi di
-- awal dan akhir dibuang, lalu huruf besar. Draft rencana dan rencana final tidak disentuh (penanda draft: T146).
UPDATE "produk" SET
  "klasifikasi" = CASE WHEN "hitung"."alasan" IS NULL THEN 'otomatis' ELSE 'manual' END,
  "alasan_manual" = "hitung"."alasan"
FROM (
  SELECT "kode", CASE
    WHEN "kode" LIKE '%-T' THEN 'display-tester'
    WHEN "kategori" IN ('KTP', 'KTL') THEN 'kertas-tester'
    WHEN upper(btrim(regexp_replace("kategori", '[\t\n\v\f\r    -     　﻿]+', ' ', 'g'), ' ')) IN ('DISPLAY PRIA', 'DISPLAY WANITA') THEN 'display'
  END AS "alasan"
  FROM "produk"
) AS "hitung"
WHERE "hitung"."kode" = "produk"."kode";
