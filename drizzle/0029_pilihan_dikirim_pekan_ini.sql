CREATE TABLE "pilihan_dikirim_pekan_ini" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pilihan_dikirim_pekan_ini_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"gudang_id" integer NOT NULL,
	"toko_id" integer NOT NULL,
	"tanggal_kirim" date NOT NULL,
	"dikirim" boolean NOT NULL,
	"dipilih_oleh" text NOT NULL,
	"dipilih_pada" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pilihan_dikirim_pekan_ini" ADD CONSTRAINT "pilihan_dikirim_pekan_ini_gudang_id_gudang_id_fk" FOREIGN KEY ("gudang_id") REFERENCES "public"."gudang"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilihan_dikirim_pekan_ini" ADD CONSTRAINT "pilihan_dikirim_pekan_ini_toko_id_toko_id_fk" FOREIGN KEY ("toko_id") REFERENCES "public"."toko"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilihan_dikirim_pekan_ini" ADD CONSTRAINT "pilihan_dikirim_pekan_ini_dipilih_oleh_user_id_fk" FOREIGN KEY ("dipilih_oleh") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pilihan_dikirim_pekan_ini_unik" ON "pilihan_dikirim_pekan_ini" USING btree ("gudang_id","toko_id","tanggal_kirim");