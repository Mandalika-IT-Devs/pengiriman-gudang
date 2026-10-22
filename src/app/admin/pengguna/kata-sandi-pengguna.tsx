"use client";

import { CircleDashed, Eye, EyeOff } from "lucide-react";
import { useState, useTransition } from "react";

import { PesanStatusSimpan } from "@/components/pesan-status-simpan";
import { Button } from "@/components/ui/button";
import { WaktuSingkat } from "@/components/waktu-singkat";

import { tampilkanKataSandi, type HasilTampilkanKataSandi } from "./aksi";

/**
 * Kolom Kata sandi satu akun (T137, PRD A3 ▶ Keputusan 2026-10-20). Kata sandinya sendiri tidak ada di sini: diminta
 * dari server saat "Tampilkan" ditekan.
 * - `admin`: akun admin, kata sandinya tidak pernah ditampilkan.
 * - `tersembunyi`: salinan tersedia, tampil "••••••••" sampai "Tampilkan" ditekan.
 * - `belumTersedia`: belum ada salinan yang sesuai kata sandi yang berlaku.
 * `diubah` = kapan dan oleh siapa kata sandi terakhir diisi; `null` = diisi sebelum fitur ini.
 */
export type KataSandiTampil = {
  keadaan: "admin" | "tersembunyi" | "belumTersedia";
  diubah: { pada: Date; oleh: string } | null;
};

const PESAN_GAGAL_TAMPILKAN = "Kata sandi tidak bisa ditampilkan. Muat ulang halaman lalu coba lagi.";

function BelumTersedia() {
  return (
    <>
      <span data-kata-sandi="belumTersedia" className="flex items-center gap-2 font-semibold">
        <CircleDashed aria-hidden strokeWidth={2} className="size-5 shrink-0 text-muted-foreground" />
        Belum tersedia
      </span>
      <span className="text-muted-foreground">Tersedia setelah pengguna mengganti kata sandinya atau admin mengatur ulang.</span>
    </>
  );
}

export function KataSandiPengguna({ idPengguna, nama, kataSandi }: { idPengguna: string; nama: string; kataSandi: KataSandiTampil }) {
  const [sandi, setSandi] = useState<string | null>(null);
  const [ternyataBelumTersedia, setTernyataBelumTersedia] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, mulai] = useTransition();

  function tampilkan() {
    setGalat(null);
    mulai(async () => {
      let hasil: HasilTampilkanKataSandi;
      try {
        hasil = await tampilkanKataSandi({ idPengguna });
      } catch {
        hasil = { keadaan: "gagal", pesan: PESAN_GAGAL_TAMPILKAN };
      }
      if (hasil.keadaan === "tersedia") setSandi(hasil.sandi);
      else if (hasil.keadaan === "belumTersedia") setTernyataBelumTersedia(true);
      else setGalat(hasil.pesan);
    });
  }

  const keadaan = kataSandi.keadaan === "tersembunyi" && ternyataBelumTersedia ? "belumTersedia" : kataSandi.keadaan;

  return (
    <div className="flex max-w-80 min-w-60 flex-col gap-1 whitespace-normal">
      {keadaan === "admin" ? (
        <span data-kata-sandi="admin">—</span>
      ) : keadaan === "belumTersedia" ? (
        <BelumTersedia />
      ) : sandi === null ? (
        <div className="flex items-center gap-2">
          <span data-kata-sandi="tersembunyi" className="font-semibold">
            <span aria-hidden>••••••••</span>
            <span className="sr-only">Kata sandi tersembunyi</span>
          </span>
          <Button type="button" size="sm" variant="ghost" aria-label={`Tampilkan kata sandi ${nama}`} disabled={memuat} onClick={tampilkan}>
            <Eye aria-hidden strokeWidth={2} className="size-5" />
            Tampilkan
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span data-kata-sandi="terlihat" className="font-semibold break-all">
            {sandi}
          </span>
          <Button type="button" size="sm" variant="ghost" aria-label={`Sembunyikan kata sandi ${nama}`} onClick={() => setSandi(null)}>
            <EyeOff aria-hidden strokeWidth={2} className="size-5" />
            Sembunyikan
          </Button>
        </div>
      )}
      {galat === null ? null : <PesanStatusSimpan keadaan="gagal" pesan={galat} />}
      <span data-kata-sandi-diubah className="text-muted-foreground">
        {kataSandi.diubah ? (
          <>
            Diubah <WaktuSingkat waktu={kataSandi.diubah.pada} /> oleh {kataSandi.diubah.oleh}
          </>
        ) : (
          "—"
        )}
      </span>
    </div>
  );
}
