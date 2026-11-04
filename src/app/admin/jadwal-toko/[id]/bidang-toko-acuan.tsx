"use client";

import { useId } from "react";

import { kelasLabel } from "@/app/pengiriman-gudang/[id]/bidang-jadwal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TokoAcuan } from "@/server/gudang/jadwal";

/** Nilai pilihan "Tanpa toko acuan" (Radix Select tidak menerima nilai kosong). */
const NILAI_KOSONG = "kosong";

/**
 * Isian "Toko acuan" di form jadwal tetap satu toko (PRD A5 ▶ Keputusan 2026-11-04, Pengaturan; T149): boleh kosong,
 * dengan keterangan yang selalu tampil. `pilihan` = toko yang boleh dipilih menurut server, urut nama (`pilihanTokoAcuan`);
 * toko yang sedang diatur (`idToko`) disaring di sini. Toko acuan yang tersimpan tetap tampil sebagai nilai walaupun kini
 * tidak lagi ada di pilihan; server memeriksanya ulang saat menyimpan.
 */
export function BidangTokoAcuan({
  idToko,
  nilai,
  pilihan,
  ubah,
  nonaktif,
}: {
  idToko: number;
  nilai: TokoAcuan | null;
  pilihan: readonly TokoAcuan[];
  ubah: (baru: TokoAcuan | null) => void;
  nonaktif: boolean;
}) {
  const id = useId();
  const daftar = pilihan.filter((t) => t.id !== idToko);

  return (
    <div className={`${kelasLabel} mt-2`}>
      <span id={`${id}-toko-acuan`}>Toko acuan</span>
      <Select
        value={nilai === null ? NILAI_KOSONG : String(nilai.id)}
        onValueChange={(baru) => ubah(baru === NILAI_KOSONG ? null : (daftar.find((t) => String(t.id) === baru) ?? null))}
        disabled={nonaktif}
      >
        <SelectTrigger aria-labelledby={`${id}-toko-acuan`} aria-describedby={`${id}-keterangan-toko-acuan`}>
          <SelectValue>{nilai === null ? "Tanpa toko acuan" : nilai.nama}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NILAI_KOSONG}>Tanpa toko acuan</SelectItem>
          {daftar.map((t) => (
            <SelectItem key={t.id} value={String(t.id)}>
              {t.nama}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id={`${id}-keterangan-toko-acuan`} data-keterangan-toko-acuan className="font-normal text-muted-foreground">
        Isi hanya untuk toko yang belum punya data penjualan. Varian dan rata-rata diambil dari toko acuan, sedangkan jadwal, stok, dan
        kategori hari tetap milik toko ini.
      </p>
    </div>
  );
}
