"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import type { HasilSimpan } from "@/components/keadaan-simpan";
import { auth } from "@/server/auth/auth";
import { catatKataSandi } from "@/server/auth/catatan-kata-sandi";
import { wajibMasuk } from "@/server/auth/kewenangan";

const PATH_HALAMAN = "/akun";

const PESAN_SANDI_SAAT_INI_SALAH = "Kata sandi saat ini salah.";

// Batas sama dengan bawaan Better Auth (minPasswordLength 8, maxPasswordLength 128), agar pesannya berbahasa Indonesia.
// Kata sandi saat ini yang kosong atau lebih dari 128 karakter tidak mungkin benar.
const skemaGantiKataSandi = z
  .object({
    sandiSaatIni: z.string().min(1, PESAN_SANDI_SAAT_INI_SALAH).max(128, PESAN_SANDI_SAAT_INI_SALAH),
    sandiBaru: z.string().min(8, "Kata sandi baru minimal 8 karakter.").max(128, "Kata sandi baru maksimal 128 karakter."),
    ulangiSandiBaru: z.string(),
  })
  .refine((isian) => isian.sandiBaru === isian.ulangiSandiBaru, { error: "Kata sandi baru dan ulangannya tidak sama." });

const pesanGalatAuth: Record<string, string> = {
  INVALID_PASSWORD: PESAN_SANDI_SAAT_INI_SALAH,
};

function gagal(pesan: string): HasilSimpan {
  return { keadaan: "gagal", pesan };
}

/**
 * Ganti kata sandi sendiri di Akun saya (T138, PRD A3 ▶ Keputusan 2026-10-20). Better Auth memeriksa kata sandi saat ini
 * lalu mengganti hash; sesi lain diakhiri, sesi yang sedang dipakai tetap. Kata sandinya dicatat lewat modul T137 dengan
 * pengguna itu sendiri sebagai pengisi: akun bukan admin menyimpan salinan terenkripsi, akun admin hanya waktu dan
 * pengisi. Penggantian dan pencatatan berjalan di bawah kunci akun yang sama, jadi salinan yang tampil tidak pernah
 * berbeda dari kata sandi yang berlaku.
 */
export async function gantiKataSandi(input: unknown): Promise<HasilSimpan> {
  const pengguna = await wajibMasuk();
  const isian = skemaGantiKataSandi.safeParse(input);
  if (!isian.success) return gagal(isian.error.issues[0].message);
  const { sandiSaatIni, sandiBaru } = isian.data;
  const kepala = await headers();
  let hashDiganti = false;
  try {
    await catatKataSandi({
      idPengguna: pengguna.id,
      sandi: sandiBaru,
      olehId: pengguna.id,
      gantiHash: async () => {
        await auth.api.changePassword({ body: { currentPassword: sandiSaatIni, newPassword: sandiBaru }, headers: kepala });
        hashDiganti = true;
        await auth.api.revokeOtherSessions({ headers: kepala });
      },
    });
  } catch (galat) {
    // Galat sebelum hash diganti: kata sandi tetap. Galat sesudahnya tidak dijadikan pesan "gagal" karena kata sandi
    // sudah berganti; form menampilkannya sebagai hasil belum pasti (CODING_STANDARDS).
    if (galat instanceof APIError && !hashDiganti) {
      const kode = typeof galat.body?.code === "string" ? galat.body.code : "";
      return gagal(pesanGalatAuth[kode] ?? "Kata sandi tidak berubah.");
    }
    throw galat;
  }
  try {
    revalidatePath(PATH_HALAMAN);
  } catch {
    return { keadaan: "tersimpanGagalMuatUlang" };
  }
  return { keadaan: "berhasil" };
}
