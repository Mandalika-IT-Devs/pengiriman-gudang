import type { Metadata } from "next";

import { DaftarGudangJadwal, metadataDaftarGudangJadwal, muatDaftarGudangJadwal } from "../pengiriman-gudang/[id]/halaman-jadwal";

/** Judul tab mengikuti peran: "Atur pengiriman di luar jadwal" bagi admin, "Usulkan …" bagi operator (T148-b). */
export async function generateMetadata(): Promise<Metadata> {
  return metadataDaftarGudangJadwal();
}

/**
 * Zona kerja (DESIGN §1). T98, T113: daftar gudang tempat pengguna berhak `kelola-usulan-jadwal`; berhak di satu gudang
 * → langsung ke gudang itu; tanpa hak → 404. T148-b (PRD A5 ▶ Keputusan 2026-11-05): bagi admin judulnya "Atur
 * pengiriman di luar jadwal", sama dengan judul form admin.
 */
export default async function HalamanDaftarUsulanJadwal() {
  const { judul, daftarGudang } = await muatDaftarGudangJadwal();
  return <DaftarGudangJadwal judul={judul} daftarGudang={daftarGudang} />;
}
