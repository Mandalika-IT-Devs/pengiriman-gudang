import { z } from "zod";

import { daftarHariKirim, daftarPersiapan, daftarPolaJadwal } from "@/server/gudang/pilihan-jadwal";

// Skema isian jadwal satu toko (T55) yang dipakai server action operator (`aksi.ts`) dan admin (`/admin/jadwal-toko`,
// T112). Aturan jadwal sendiri divalidasi domain (`periksaJadwal`, T54). Tanpa tanggal jangkar (PRD A5 ▶ Revisi
// 2026-10-19, T135); isian lain di luar skema dibuang.

export const skemaToko = z.object({
  idGudang: z.number().int(),
  idToko: z.number({ error: "Pilih toko." }).int({ error: "Pilih toko." }),
});

export const isianJadwal = {
  pola: z.enum(daftarPolaJadwal, { error: "Pilih pola jadwal." }),
  hariKirim: z.array(
    z.object({
      hari: z.enum(daftarHariKirim, { error: "Hari kirim tidak dikenal." }),
      persiapan: z.enum(daftarPersiapan, { error: "Pilih persiapan H, H−1, atau H−2." }),
    }),
    { error: "Pilih hari kirim." },
  ),
  /** "Tambah 3 hari cakupan" (PRD A5 ▶ Keputusan 2026-10-27, T144); tidak dikirim = tidak dicentang. */
  tambah3HariCakupan: z.boolean({ error: "Pilihan Tambah 3 hari cakupan tidak dikenal." }).default(false),
};

export const skemaJadwal = skemaToko.extend(isianJadwal);
