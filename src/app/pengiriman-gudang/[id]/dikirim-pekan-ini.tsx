import { CircleMinus } from "lucide-react";

import { formatAngka } from "@/app/admin/impor/format";
import { BantuanIstilah } from "@/components/bantuan-istilah";
import { Badge } from "@/components/ui/badge";
import { WaktuSingkat } from "@/components/waktu-singkat";
import { formatTanggal, type TanggalBisnis } from "@/domain/kalender";
import type { DikirimPekanIni } from "@/server/gudang/dikirim-pekan-ini";

import { FormDikirimPekanIni } from "./form-dikirim-pekan-ini";

// Dikirim pekan ini di draft (T134, PRD A5 ▶ Revisi 2026-10-19; GLOSSARY "Dikirim pekan ini", "Kirim terakhir"). Status
// tampil sebagai ikon + teks (DESIGN §7). DESIGN §7 belum punya baris untuk "Tidak dikirim pekan ini": token `muted` dan
// `CircleMinus`, yang sudah dipakai untuk keadaan "tidak ikut" lain (hasil unggah stok, alias "Sudah ada").

const LABEL_TIDAK_DIKIRIM_PEKAN_INI = "Tidak dikirim pekan ini";

/** Penanda toko yang Tidak dikirim pekan ini: ringkasan per toko dan kepala toko yang dibuka. */
export function PenandaTidakDikirim() {
  return (
    <Badge variant="muted" data-tidak-dikirim-pekan-ini="">
      <CircleMinus aria-hidden strokeWidth={2} className="size-5" />
      {LABEL_TIDAK_DIKIRIM_PEKAN_INI}
    </Badge>
  );
}

function teksKirimTerakhir(kirimTerakhir: DikirimPekanIni["kirimTerakhir"]) {
  if (kirimTerakhir === null) return "Belum ada rencana final sebelumnya";
  return `Kirim terakhir: ${formatTanggal(kirimTerakhir.tanggal)} (${formatAngka(kirimTerakhir.selisihHari)} hari sebelumnya)`;
}

/** Asal nilai pilihan: rencana final tanggal ini, pilihan operator (siapa dan kapan), atau nilai otomatis. */
function AsalPilihan({ keadaan }: { keadaan: DikirimPekanIni }) {
  if (keadaan.sudahFinal) {
    return (
      <p data-asal-pilihan="final" className="text-muted-foreground">
        Sudah punya rencana final untuk tanggal ini, jadi selalu Dikirim.
      </p>
    );
  }
  if (keadaan.dipilih === null) {
    return (
      <p data-asal-pilihan="otomatis" className="text-muted-foreground">
        Otomatis dari kirim terakhir, belum dipilih operator.
      </p>
    );
  }
  return (
    <p data-asal-pilihan="operator" className="text-muted-foreground">
      Dipilih {keadaan.dipilih.oleh} pada <WaktuSingkat waktu={keadaan.dipilih.pada} />
    </p>
  );
}

/**
 * Kirim terakhir dan pilihan "Dikirim pekan ini" toko dua mingguan yang dibuka di draft. `ubah` = operator dengan hak
 * `finalisasi` (diperiksa lagi di server); `null` = hanya-baca (admin, viewer, operator tanpa hak itu). Toko yang sudah
 * final untuk tanggal ini selalu Dikirim dan pilihannya tidak bisa diubah. Toko tanpa pilihan tidak menampilkan apa pun.
 */
export function BagianDikirimPekanIni({
  toko,
  ubah,
}: {
  toko: { id: number; nama: string; dikirimPekanIni: DikirimPekanIni | null };
  ubah: { idGudang: number; tanggalKirim: TanggalBisnis } | null;
}) {
  const keadaan = toko.dikirimPekanIni;
  if (keadaan === null) return null;
  return (
    <div data-dikirim-pekan-ini={toko.id} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {ubah !== null && !keadaan.sudahFinal ? (
          <FormDikirimPekanIni
            idGudang={ubah.idGudang}
            tanggalKirim={ubah.tanggalKirim}
            tokoId={toko.id}
            namaToko={toko.nama}
            dikirim={keadaan.dikirim}
          />
        ) : (
          <p data-nilai-dikirim-pekan-ini={keadaan.dikirim ? "ya" : "tidak"} className="flex min-h-11 items-center gap-1">
            <span>Dikirim pekan ini:</span>
            <span className="font-semibold">{keadaan.dikirim ? "Dikirim" : LABEL_TIDAK_DIKIRIM_PEKAN_INI}</span>
            <BantuanIstilah istilah="dikirimPekanIni" />
          </p>
        )}
        <p data-kirim-terakhir className="text-muted-foreground">
          {teksKirimTerakhir(keadaan.kirimTerakhir)}
        </p>
      </div>
      <AsalPilihan keadaan={keadaan} />
    </div>
  );
}
