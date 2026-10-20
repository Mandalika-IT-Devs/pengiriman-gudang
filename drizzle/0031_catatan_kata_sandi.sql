CREATE TABLE "catatan_kata_sandi" (
	"user_id" text PRIMARY KEY NOT NULL,
	"salinan_terenkripsi" text,
	"diisi_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diisi_oleh" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catatan_kata_sandi" ADD CONSTRAINT "catatan_kata_sandi_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catatan_kata_sandi" ADD CONSTRAINT "catatan_kata_sandi_diisi_oleh_user_id_fk" FOREIGN KEY ("diisi_oleh") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;