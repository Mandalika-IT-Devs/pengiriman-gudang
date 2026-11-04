import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, type Peran } from "@/server/auth/auth";
import { daftarGudangDapatDilihat, punyaHakTindakan, type GudangDapatDilihat } from "@/server/gudang/akses";
import type { HakTindakan } from "@/server/gudang/hak-tindakan";

// CODING_STANDARDS "Kewenangan": setiap server action dan route memeriksa peran di server,
// sebelum membaca atau menulis data. Menyembunyikan tombol di UI hanya tambahan.
// Hak tindakan dibaca dari satu aturan di `@/server/gudang/akses` (PRD A3 ▶ Keputusan 2026-11-04): operator dari
// penugasan gudang; admin memegang kelima hak di setiap gudang aktif tanpa penugasan; gudang nonaktif hanya-baca.

export type PenggunaMasuk = { id: string; nama: string; email: string; peran: Peran };

export class AksesDitolakError extends Error {
  constructor(pesan = "Hanya admin yang boleh melakukan tindakan ini.") {
    super(pesan);
    this.name = "AksesDitolakError";
  }
}

/** Pengguna yang sedang masuk, atau `null`. Peran selain "admin" diperlakukan sebagai "viewer" (hak paling kecil). */
export async function penggunaSaatIni(): Promise<PenggunaMasuk | null> {
  const sesi = await auth.api.getSession({ headers: await headers() });
  if (!sesi || sesi.user.banned) return null;
  return {
    id: sesi.user.id,
    nama: sesi.user.name,
    email: sesi.user.email,
    peran: sesi.user.role === "admin" ? "admin" : "viewer",
  };
}

/** Pengguna yang belum masuk diarahkan ke halaman masuk. */
export async function wajibMasuk(): Promise<PenggunaMasuk> {
  const pengguna = await penggunaSaatIni();
  if (!pengguna) redirect("/masuk");
  return pengguna;
}

/** Seperti `wajibMasuk`, lalu menolak pengguna yang bukan admin dengan `AksesDitolakError`. */
export async function wajibAdmin(): Promise<PenggunaMasuk> {
  const pengguna = await wajibMasuk();
  if (pengguna.peran !== "admin") throw new AksesDitolakError();
  return pengguna;
}

/**
 * Seperti `wajibMasuk`, lalu menolak dengan `AksesDitolakError` jika pengguna tidak memegang hak `tindakan` di
 * `idGudang` (`punyaHakTindakan`): admin lolos di setiap gudang aktif tanpa penugasan; operator hanya dengan hak dari
 * penugasannya. Gudang nonaktif atau yang tidak ada ditolak untuk siapa pun (PRD A3 ▶ Keputusan 2026-11-04).
 */
export async function wajibHakTindakan(idGudang: number, tindakan: HakTindakan): Promise<PenggunaMasuk> {
  const pengguna = await wajibMasuk();
  if (!(await punyaHakTindakan(pengguna, idGudang, tindakan))) {
    throw new AksesDitolakError("Anda tidak punya hak tindakan ini di gudang tersebut.");
  }
  return pengguna;
}

/**
 * Seperti `wajibMasuk`, lalu mengembalikan gudang yang boleh dilihat di halaman Pengiriman Gudang beserta hak tindakan
 * pengguna di setiap gudang. Menolak dengan `AksesDitolakError` jika tidak ada (viewer tanpa penugasan).
 */
export async function wajibAksesPengirimanGudang(): Promise<{ pengguna: PenggunaMasuk; daftarGudang: GudangDapatDilihat[] }> {
  const pengguna = await wajibMasuk();
  const daftarGudang = await daftarGudangDapatDilihat(pengguna);
  if (daftarGudang.length === 0) throw new AksesDitolakError("Anda belum ditugaskan di gudang mana pun.");
  return { pengguna, daftarGudang };
}

/**
 * Seperti `wajibMasuk`, lalu menolak dengan `AksesDitolakError` jika pengguna tidak boleh melihat Pengiriman Gudang
 * `idGudang`: tidak punya penugasan di gudang itu dan bukan admin (PRD A3). Tindakan tetap diperiksa lagi lewat
 * `wajibHakTindakan`.
 * `daftarGudang` = semua gudang yang boleh dilihat pengguna (untuk `gudangLangsungMasuk`).
 */
export async function wajibAksesLihatGudang(
  idGudang: number,
): Promise<{ pengguna: PenggunaMasuk; gudang: GudangDapatDilihat; daftarGudang: GudangDapatDilihat[] }> {
  const pengguna = await wajibMasuk();
  const daftarGudang = await daftarGudangDapatDilihat(pengguna);
  const gudang = daftarGudang.find((g) => g.id === idGudang);
  if (!gudang) throw new AksesDitolakError("Anda tidak punya akses ke gudang tersebut.");
  return { pengguna, gudang, daftarGudang };
}

/**
 * Seperti `wajibMasuk`, lalu mengembalikan gudang tempat pengguna memegang hak `tindakan` (T98: halaman Kirim di luar
 * jadwal), dengan aturan `daftarGudangDapatDilihat`: bagi admin, setiap gudang aktif (PRD A3 ▶ Keputusan 2026-11-04).
 * Menolak dengan `AksesDitolakError` jika tidak ada.
 */
export async function wajibGudangDenganHak(tindakan: HakTindakan): Promise<GudangDapatDilihat[]> {
  const pengguna = await wajibMasuk();
  const daftarGudang = (await daftarGudangDapatDilihat(pengguna)).filter((g) => g.hakTindakan.includes(tindakan));
  if (daftarGudang.length === 0) throw new AksesDitolakError("Anda tidak punya hak tindakan ini di gudang mana pun.");
  return daftarGudang;
}
