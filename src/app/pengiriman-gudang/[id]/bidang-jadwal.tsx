"use client";

import { useId, type ReactNode } from "react";

import { kelasChip } from "@/app/ringkasan/pilihan-ringkasan";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  daftarHariKirim,
  daftarPersiapan,
  daftarPolaJadwal,
  labelPersiapan,
  labelPola,
  type HariKirim,
  type IsianJadwal,
  type Persiapan,
  type PolaJadwal,
} from "@/server/gudang/pilihan-jadwal";

/** Isian satu pengaturan jadwal; divalidasi domain (`periksaJadwal`, T54) di server. */
export type { IsianJadwal };

export const ISIAN_KOSONG: IsianJadwal = {
  pola: "mingguan",
  hariKirim: [],
  tambah3HariCakupan: false,
};

export const kelasLabel = "flex flex-col gap-2 font-semibold";

/** Isian siap kirim: hari kirim urut Senin–Minggu. */
export function isianTerkirim(isian: IsianJadwal): IsianJadwal {
  const persiapanHari = new Map(isian.hariKirim.map((h) => [h.hari, h.persiapan]));
  const hariKirim = daftarHariKirim.flatMap((hari) => {
    const persiapan = persiapanHari.get(hari);
    return persiapan ? [{ hari, persiapan }] : [];
  });
  return { pola: isian.pola, hariKirim, tambah3HariCakupan: isian.tambah3HariCakupan };
}

/**
 * Bidang pola dan hari kirim beserta persiapannya (PRD A5). Dipakai form jadwal satu toko (T55, T56) dan form salin jadwal
 * (T57). `bidangAwal` tampil di baris yang sama dengan pola (mis. pilihan toko). Tanpa tanggal jangkar; pola dua mingguan
 * menampilkan keterangan pemilihan pekannya (PRD A5 ▶ Revisi 2026-10-19, T135). Tepat di bawah Pola, checkbox "Tambah 3
 * hari cakupan" untuk semua pola dengan keterangan yang selalu tampil (PRD A5 ▶ Keputusan 2026-10-27, T144).
 */
export function BidangJadwal({
  isian,
  ubah,
  nonaktif,
  bidangAwal,
}: {
  isian: IsianJadwal;
  ubah: (baru: Partial<IsianJadwal>) => void;
  nonaktif: boolean;
  bidangAwal?: ReactNode;
}) {
  const id = useId();
  const persiapanHari = new Map(isian.hariKirim.map((h) => [h.hari, h.persiapan]));

  function pilihHari(hari: HariKirim, centang: boolean) {
    const sisa = isian.hariKirim.filter((h) => h.hari !== hari);
    ubah({ hariKirim: centang ? [...sisa, { hari, persiapan: "H" }] : sisa });
  }

  function pilihPersiapan(hari: HariKirim, persiapan: Persiapan) {
    ubah({
      hariKirim: isian.hariKirim.map((h) => (h.hari === hari ? { hari, persiapan } : h)),
    });
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {bidangAwal}
        <div className={kelasLabel}>
          <span id={`${id}-pola`}>Pola</span>
          <Select value={isian.pola} onValueChange={(nilai) => ubah({ pola: nilai as PolaJadwal })} disabled={nonaktif}>
            <SelectTrigger aria-labelledby={`${id}-pola`}>
              <SelectValue>{labelPola[isian.pola]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {daftarPolaJadwal.map((pola) => (
                <SelectItem key={pola} value={pola}>
                  {labelPola[pola]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className={`${kelasChip} w-fit`}>
            <input
              type="checkbox"
              name="tambah3HariCakupan"
              checked={isian.tambah3HariCakupan}
              onChange={(e) => ubah({ tambah3HariCakupan: e.target.checked })}
              disabled={nonaktif}
              aria-describedby={`${id}-tambah-3-hari`}
              className="size-4 accent-primary outline-none"
            />
            Tambah 3 hari cakupan
          </label>
          <p id={`${id}-tambah-3-hari`} data-keterangan-tambah-3-hari className="font-normal text-muted-foreground">
            Cakupan setiap pengiriman toko ini diperpanjang 3 hari sesudah hari terakhirnya.
          </p>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2" disabled={nonaktif}>
        <legend className="mb-2 font-semibold">Hari kirim dan persiapan</legend>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {daftarHariKirim.map((hari) => {
            const persiapan = persiapanHari.get(hari);
            return (
              <li key={hari} className="flex items-center gap-2">
                <label className={kelasChip}>
                  <input
                    type="checkbox"
                    name="hariKirim"
                    value={hari}
                    checked={persiapan !== undefined}
                    onChange={(e) => pilihHari(hari, e.target.checked)}
                    className="size-4 accent-primary outline-none"
                  />
                  {hari}
                </label>
                <Select
                  value={persiapan ?? ""}
                  onValueChange={(nilai) => pilihPersiapan(hari, nilai as Persiapan)}
                  disabled={nonaktif || persiapan === undefined}
                >
                  <SelectTrigger ukuran="tabel" aria-label={`Persiapan hari ${hari}`} className="w-24">
                    <SelectValue placeholder="—">{persiapan ? labelPersiapan[persiapan] : undefined}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {daftarPersiapan.map((p) => (
                      <SelectItem key={p} value={p}>
                        {labelPersiapan[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {isian.pola === "dua-mingguan" ? (
        <p data-keterangan-dua-mingguan className="text-muted-foreground">
          Toko dikirim pada hari kirim ini. Operator memilih pekannya di draft, biasanya setiap 2 minggu.
        </p>
      ) : null}
    </>
  );
}
