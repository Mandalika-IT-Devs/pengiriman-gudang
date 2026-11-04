import { eq } from "drizzle-orm";

import { nonaktifkanToko } from "@/domain/toko-acuan";
import { db } from "@/server/db";
import { toko } from "@/server/db/schema";

import { kunciTokoAcuan, peminjamTokoAcuan } from "./jadwal";

/** Hasil menetapkan status toko: `tidakDitemukan` = toko tidak ada; `ditolak` = aturan toko acuan (T150). */
export type HasilStatusToko = { keadaan: "berhasil" } | { keadaan: "tidakDitemukan" } | { keadaan: "ditolak"; pesan: string };

/**
 * Menetapkan status aktif/nonaktif satu toko (T76). Hubungan toko–gudang dan jadwal tidak diubah; aturan yang memakai
 * status toko (draft, peringatan jadwal) membaca status ini apa adanya (PRD A6 ▶ Keputusan T58). Menonaktifkan toko yang
 * sedang menjadi toko acuan di jadwal tetap aktif toko lain ditolak (`nonaktifkanToko`, PRD A5 ▶ Keputusan 2026-11-04,
 * T150).
 *
 * Urutan kunci sama dengan penyimpanan jadwal tetap: baris toko dulu, lalu kunci advisory toko acuan, sehingga pemeriksaan
 * dan penulisan bergiliran dengan pengisian toko acuan tanpa saling menunggu. Kunci baris `no key update` tidak menahan
 * pemeriksaan rujukan (foreign key) jadwal toko lain yang memakai toko ini.
 */
export async function tetapkanAktifToko(idToko: number, aktif: boolean): Promise<HasilStatusToko> {
  return db.transaction(async (tx) => {
    const [ini] = await tx.select({ nama: toko.nama }).from(toko).where(eq(toko.id, idToko)).for("no key update");
    if (!ini) return { keadaan: "tidakDitemukan" };
    if (!aktif) {
      await kunciTokoAcuan(tx);
      const hasil = nonaktifkanToko({ toko: ini.nama, dipakaiSebagaiAcuanOleh: await peminjamTokoAcuan(tx, idToko) });
      if (hasil.hasil === "ditolak") return { keadaan: "ditolak", pesan: hasil.pesan };
    }
    await tx.update(toko).set({ aktif }).where(eq(toko.id, idToko));
    return { keadaan: "berhasil" };
  });
}
