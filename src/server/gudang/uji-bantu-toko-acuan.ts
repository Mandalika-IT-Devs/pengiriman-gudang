import { eq, inArray } from "drizzle-orm";

import type { KategoriDasar, NamaHari } from "@/domain/kalender";
import { db } from "@/server/db";
import { draftRencana, hubunganTokoGudang, jadwalToko, produk, rencanaFinal } from "@/server/db/schema";
import { aktifkanImpor } from "@/server/impor/impor";
import { pastikanBucket } from "@/server/impor/penyimpanan";
import { buatWorkbookUji, imporUji, kodeProdukUji, sheetPenjualanUji, tahunUjiBebas, type ProdukUji } from "@/server/impor/uji-bantu";
import { hitungUlangCacheLaporan } from "@/server/laporan/cache";
import { kuantitasJuniMenurutHari } from "@/server/laporan/uji-bantu";
import { buatKeluargaUji, publikasikanRankingUji } from "@/server/ranking/uji-bantu";

import { tetapkanPeriodeSumber } from "./periode-sumber";
import { buatTokoUji } from "./uji-bantu";

// Bantuan khusus test T151 (golden `toko-acuan.json`, PRD A5 ▶ Keputusan 2026-11-04): TOKO BARU tanpa data penjualan
// meminjam varian dan rata-rata SMB. SMB punya rata-rata PW110P-GOR Senin–Kamis 5, Jumat 5, Sabtu 8, Minggu 7 (contoh
// PRD A6 ▶ Revisi 2026-10-12) dan satu produk yang penjualannya nol. LMK juga memakai toko acuan SMB, tetapi sudah punya
// data penjualan sendiri dengan angka lain. Ketiganya mingguan Kamis (H−1); hanya TOKO BARU dan LMK yang memakai toko
// acuan. Sel kosong di blok toko berarti nol (PRD A1), jadi semua blok dalam satu sheet punya produk yang sama.

const RATA_RATA_SMB: Record<KategoriDasar, number> = { "Senin–Kamis": 5, Jumat: 5, Sabtu: 8, Minggu: 7 };
const SEMUA_HARI_JUNI = Array.from({ length: 30 }, (_, i) => i + 1);
const kategoriHari = (nama: NamaHari): KategoriDasar => (nama === "Jumat" || nama === "Sabtu" || nama === "Minggu" ? nama : "Senin–Kamis");

type BlokToko = { toko: string; kuantitas: ProdukUji["kuantitas"][] };

/**
 * Sheet penjualan dengan beberapa blok toko berdampingan (setiap blok mulai sesudah kolom tanggal blok sebelumnya).
 * Baris produk dipakai bersama; `kuantitas` blok sejajar dengan `produk`.
 */
function sheetBeberapaToko({
  bulan,
  hari,
  produk: daftarProduk,
  blok,
}: {
  bulan: number;
  hari: number[];
  produk: Omit<ProdukUji, "kuantitas">[];
  blok: BlokToko[];
}) {
  const lebarBlok = 5 + hari.length;
  const sheet = blok.map((b) =>
    sheetPenjualanUji({ toko: b.toko, bulan, hari, produk: daftarProduk.map((p, i) => ({ ...p, kuantitas: b.kuantitas[i] })) }),
  );
  return sheet[0].map((baris, i) => [
    ...baris,
    ...Array<null>(lebarBlok - baris.length).fill(null),
    ...sheet.slice(1).flatMap((s) => {
      const isi = s[i].slice(5);
      return [...isi, ...Array<null>(hari.length - isi.length).fill(null)];
    }),
  ]);
}

async function aktifkanSheetUji({
  idAdmin,
  tahun,
  bulan,
  namaSheet,
  isi,
}: {
  idAdmin: string;
  tahun: number;
  bulan: number;
  namaSheet: string;
  isi: ReturnType<typeof sheetBeberapaToko>;
}) {
  const idImpor = await imporUji({
    isi: buatWorkbookUji({ [namaSheet]: isi }),
    namaSheet,
    tahunImpor: tahun,
    bulanImpor: bulan,
    idPengguna: idAdmin,
  });
  const hasil = await aktifkanImpor(idImpor, idAdmin);
  if (hasil.keadaan !== "berhasil") throw new Error(`Aktivasi impor uji gagal: ${JSON.stringify(hasil)}`);
}

/**
 * Toko uji SMB, TOKO BARU, dan LMK di gudang `idGudang` dengan jadwal tetap mingguan Kamis (H−1); TOKO BARU dan LMK memakai
 * toko acuan SMB. Impor Juni: SMB punya `gor` (rata-rata contoh) dan `nol` (penjualan nol); LMK punya `gor` 1 dan `nol` 2
 * setiap hari. Impor Juli (tahun lain): hanya LMK. Periode sumber gudang = Juni; `bulanTanpaSmb` = Juli itu (SMB tanpa
 * varian). `gor` dan
 * `nol` dipetakan ke keluarga tujuh besar ranking berlaku.
 */
export async function siapkanTokoAcuanUji({ idGudang, idAdmin }: { idGudang: number; idAdmin: string }) {
  await db.delete(draftRencana).where(eq(draftRencana.gudangId, idGudang));
  const [smb, tokoBaru, lmk] = [await buatTokoUji(), await buatTokoUji(), await buatTokoUji()];
  await db.insert(hubunganTokoGudang).values([smb, tokoBaru, lmk].map((t) => ({ tokoId: t.id, gudangId: idGudang })));
  const mingguanKamis = {
    pola: "mingguan" as const,
    hariKirim: [{ hari: "Kamis" as const, persiapanHari: 1 as const }],
    dibuatOleh: idAdmin,
  };
  await db.insert(jadwalToko).values([
    { ...mingguanKamis, tokoId: smb.id },
    { ...mingguanKamis, tokoId: tokoBaru.id, tokoAcuanId: smb.id },
    { ...mingguanKamis, tokoId: lmk.id, tokoAcuanId: smb.id },
  ]);

  await pastikanBucket();
  const tahun = await tahunUjiBebas();
  const kode = { gor: kodeProdukUji("GOR"), nol: kodeProdukUji("SAN") };
  const produkSheet = [
    { kode: kode.gor, nama: "PW110P - GORGEOUS", ukuran: "110ML", kategori: "PARFUM WANITA" },
    { kode: kode.nol, nama: "PW110P - SANTAL", ukuran: "110ML", kategori: "PARFUM WANITA" },
  ];
  const tetap = (n: number) => SEMUA_HARI_JUNI.map(() => n);
  await aktifkanSheetUji({
    idAdmin,
    tahun,
    bulan: 6,
    namaSheet: "JUNI (S)",
    isi: sheetBeberapaToko({
      bulan: 6,
      hari: SEMUA_HARI_JUNI,
      produk: produkSheet,
      blok: [
        {
          toko: smb.nama,
          kuantitas: [kuantitasJuniMenurutHari(tahun, SEMUA_HARI_JUNI, (nama) => RATA_RATA_SMB[kategoriHari(nama)]), tetap(0)],
        },
        { toko: lmk.nama, kuantitas: [tetap(1), tetap(2)] },
      ],
    }),
  });
  // Tahun lain: bulan laporan Juli bisa memuat tanggal akhir Juni (PRD B5), dan Juni tahun ini berisi data SMB.
  const tahunTanpaSmb = await tahunUjiBebas();
  await aktifkanSheetUji({
    idAdmin,
    tahun: tahunTanpaSmb,
    bulan: 7,
    namaSheet: "JULI (S)",
    isi: sheetBeberapaToko({
      bulan: 7,
      hari: SEMUA_HARI_JUNI,
      produk: produkSheet,
      blok: [{ toko: lmk.nama, kuantitas: [tetap(1), tetap(2)] }],
    }),
  });
  await hitungUlangCacheLaporan();
  const hasil = await tetapkanPeriodeSumber({ idGudang, bulan: [`${tahun}-06`], idPengguna: idAdmin });
  if (hasil.keadaan !== "berhasil") throw new Error(hasil.pesan);

  const keluarga = await buatKeluargaUji();
  await publikasikanRankingUji({ keluarga: [keluarga.id], idPengguna: idAdmin });
  await db
    .update(produk)
    .set({ statusKeluargaAroma: "terpetakan", keluargaAromaId: keluarga.id })
    .where(inArray(produk.kode, [kode.gor, kode.nol]));
  return { smb, tokoBaru, lmk, kode, bulanTanpaSmb: `${tahunTanpaSmb}-07` };
}

/** Membersihkan draft dan rencana final gudang, serta melepas toko uji dari gudang agar tidak ikut berkas test lain. */
export async function bersihkanTokoAcuanUji({ idGudang, idToko }: { idGudang: number; idToko: number[] }) {
  await db.delete(draftRencana).where(eq(draftRencana.gudangId, idGudang));
  await db.delete(rencanaFinal).where(eq(rencanaFinal.gudangId, idGudang));
  await db.delete(hubunganTokoGudang).where(inArray(hubunganTokoGudang.tokoId, idToko));
}
