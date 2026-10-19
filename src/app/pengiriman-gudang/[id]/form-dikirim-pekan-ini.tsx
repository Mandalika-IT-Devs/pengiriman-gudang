"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { BantuanIstilah } from "@/components/bantuan-istilah";
import { usePenyimpanan } from "@/components/keadaan-simpan";
import { PesanStatusSimpan } from "@/components/pesan-status-simpan";
import { Button } from "@/components/ui/button";
import type { TanggalBisnis } from "@/domain/kalender";

import { ubahDikirimPekanIni } from "./aksi-dikirim-pekan-ini";

/**
 * Pilihan "Dikirim" / "Tidak dikirim pekan ini" satu toko dua mingguan di draft (T134, PRD A5 ▶ Revisi 2026-10-19), untuk
 * operator dengan hak `finalisasi`; server action memeriksa hak dan syaratnya lagi. Keadaan simpan mengikuti PRD A7
 * (belum disimpan, sedang menyimpan, berhasil, gagal, tersimpan tetapi gagal memuat ulang). `dikirim` = keadaan saat ini.
 */
export function FormDikirimPekanIni({
  idGudang,
  tanggalKirim,
  tokoId,
  namaToko,
  dikirim,
}: {
  idGudang: number;
  tanggalKirim: TanggalBisnis;
  tokoId: number;
  namaToko: string;
  dikirim: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [pilihan, setPilihan] = useState(dikirim);
  const { tampilan, menunggu, tandaiBerubah, simpan } = usePenyimpanan(`pilihan Dikirim pekan ini ${namaToko}`);

  function pilih(nilai: boolean) {
    setPilihan(nilai);
    tandaiBerubah();
  }

  return (
    <form
      data-form-dikirim-pekan-ini={tokoId}
      aria-label={`Dikirim pekan ini ${namaToko}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        simpan(
          () => ubahDikirimPekanIni({ idGudang, tanggalKirim, tokoId, dikirim: pilihan }),
          () => router.refresh(),
        );
      }}
    >
      <div role="radiogroup" aria-labelledby={`${id}-judul`} className="flex flex-wrap items-center gap-x-4">
        <span className="inline-flex items-center gap-1 font-semibold">
          <span id={`${id}-judul`}>Dikirim pekan ini</span>
          <BantuanIstilah istilah="dikirimPekanIni" />
        </span>
        {[
          { nilai: true, label: "Dikirim", kode: "ya" },
          { nilai: false, label: "Tidak dikirim pekan ini", kode: "tidak" },
        ].map((p) => (
          <label key={p.kode} htmlFor={`${id}-${p.kode}`} className="flex min-h-11 cursor-pointer items-center gap-2">
            <input
              id={`${id}-${p.kode}`}
              type="radio"
              name={`${id}-dikirim`}
              data-pilihan-dikirim={p.kode}
              className="size-5 cursor-pointer accent-primary"
              checked={pilihan === p.nilai}
              onChange={() => pilih(p.nilai)}
            />
            {p.label}
          </label>
        ))}
      </div>
      <Button type="submit" variant="outline" disabled={menunggu || pilihan === dikirim} className="w-fit active:scale-95">
        Simpan pilihan
        <span className="sr-only"> {namaToko}</span>
      </Button>
      {tampilan ? <PesanStatusSimpan keadaan={tampilan.keadaan} pesan={tampilan.pesan} /> : null}
    </form>
  );
}
