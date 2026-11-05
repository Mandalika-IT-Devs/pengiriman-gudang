import { Info } from "lucide-react";

import { BantuanIstilah } from "@/components/bantuan-istilah";
import { cn } from "@/lib/utils";

// Toko acuan di draft (PRD A5 ▶ Keputusan 2026-11-04, Tampilan; T151): keterangan asal rata-rata di kepala toko dan di
// rincian baris, serta catatan bila toko itu sudah punya data penjualan sendiri. Teksnya persis PRD.

/** "Rata-rata dipinjam dari toko acuan <B>" dengan bantuan istilah "Toko acuan" (DESIGN §11.6). */
export function KeteranganTokoAcuan({ nama, className }: { nama: string; className?: string }) {
  return (
    <p data-toko-acuan={nama} className={cn("flex items-center gap-1", className)}>
      {`Rata-rata dipinjam dari toko acuan ${nama}`}
      <BantuanIstilah istilah="tokoAcuan" />
    </p>
  );
}

/**
 * Catatan toko yang sudah punya data penjualan sendiri di periode sumber tetapi tetap memakai toko acuan. Keterangan,
 * bukan status: ikon `Info` + teks dengan token `info`, seperti keterangan lain di aplikasi. Tidak menahan finalisasi.
 */
export function CatatanDataSendiri() {
  return (
    <p data-catatan-data-sendiri className="flex basis-full items-start gap-2">
      <Info aria-hidden strokeWidth={2} className="size-5 shrink-0 text-info" />
      Toko ini sudah punya data penjualan sendiri di periode sumber. Rata-rata tetap dipinjam dari toko acuan sampai admin menghapusnya di
      Jadwal toko.
    </p>
  );
}
