"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { HasilSimpan } from "@/components/keadaan-simpan";
import { parseTanggalBisnis } from "@/domain/kalender";
import { wajibHakTindakan } from "@/server/auth/kewenangan";
import { simpanPilihanDikirimPekanIni } from "@/server/gudang/dikirim-pekan-ini";

// Pilihan "Dikirim pekan ini" toko dua mingguan di draft (T134, PRD A5 ▶ Revisi 2026-10-19). Pilihan ini menentukan
// apakah toko ikut difinalisasi, jadi hak `finalisasi` di gudang itu diperiksa di server sebelum membaca atau menulis
// data; admin, viewer, dan operator tanpa hak itu ditolak (hanya melihat).

const skemaGudang = z.object({ idGudang: z.number().int() });

const skemaPilihan = skemaGudang.extend({
  tanggalKirim: z.string(),
  tokoId: z.number().int(),
  dikirim: z.boolean({ error: "Pilih Dikirim atau Tidak dikirim pekan ini." }),
});

/** Menyimpan pilihan Dikirim / Tidak dikirim pekan ini satu toko untuk tanggal kirim draft, lalu memuat ulang halaman. */
export async function ubahDikirimPekanIni(input: unknown): Promise<HasilSimpan> {
  const gudang = skemaGudang.safeParse(input);
  // Id gudang tidak terbaca → tidak ada gudang yang cocok, jadi pemeriksaan hak tetap menolak.
  const operator = await wajibHakTindakan(gudang.success ? gudang.data.idGudang : 0, "finalisasi");
  const isian = skemaPilihan.safeParse(input);
  if (!isian.success) return { keadaan: "gagal", pesan: isian.error.issues[0].message };
  let tanggalKirim;
  try {
    tanggalKirim = parseTanggalBisnis(isian.data.tanggalKirim);
  } catch {
    return { keadaan: "gagal", pesan: "Tanggal kirim tidak valid." };
  }

  const { idGudang, tokoId, dikirim } = isian.data;
  const hasil = await simpanPilihanDikirimPekanIni({ idGudang, tanggalKirim, tokoId, dikirim, idPengguna: operator.id });
  if (hasil.keadaan === "gagal") return hasil;
  try {
    revalidatePath(`/pengiriman-gudang/${idGudang}`);
  } catch {
    return { keadaan: "tersimpanGagalMuatUlang" };
  }
  return { keadaan: "berhasil" };
}
