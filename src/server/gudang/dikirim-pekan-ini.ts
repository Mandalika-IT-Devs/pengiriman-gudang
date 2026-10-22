import { and, eq, inArray, lt, max, sql } from "drizzle-orm";

import { nilaiAwalDikirimPekanIni } from "@/domain/dikirim-pekan-ini";
import { punyaPilihanDikirimPekanIni } from "@/domain/jadwal";
import { parseTanggalBisnis, type TanggalBisnis } from "@/domain/kalender";
import { db } from "@/server/db";
import { gudang, pilihanDikirimPekanIni, rencanaFinal, user } from "@/server/db/schema";

import type { Tx } from "./jadwal";
import { jadwalKirimTokoGudang } from "./pengiriman-di-luar-jadwal";

// Dikirim pekan ini (T134, PRD A5 ▶ Revisi 2026-10-19; GLOSSARY "Dikirim pekan ini", "Kirim terakhir"). Toko dua mingguan
// pada tanggal kirim rutinnya (menurut jadwal tetap aktif dan pengiriman di luar jadwal yang berlaku) punya pilihan Dikirim
// / Tidak dikirim pekan ini: pilihan operator yang tersimpan, atau nilai awal otomatis dari kirim terakhir. Toko yang sudah
// punya rencana final untuk tanggal itu di gudang ini selalu Dikirim. Keadaan dibaca saat dibutuhkan, sehingga nilai awal
// selalu mengikuti rencana final terbaru. Kewenangan diperiksa pemanggil (server action).

type Klien = typeof db | Tx;

export const PESAN_BUKAN_DUA_MINGGUAN_RUTIN =
  "Pilihan Dikirim pekan ini hanya untuk toko dua mingguan pada tanggal kirim rutinnya. Muat ulang halaman untuk melihat jadwal terbaru.";

export const PESAN_SUDAH_FINAL_SELALU_DIKIRIM =
  "Toko ini sudah punya rencana final untuk tanggal ini, jadi selalu Dikirim. Pilihannya tidak bisa diubah.";

/** Keadaan pilihan dikirim pekan ini satu toko dua mingguan pada satu tanggal kirim rutinnya. */
export type DikirimPekanIni = {
  /** `true` = Dikirim; `false` = Tidak dikirim pekan ini. */
  dikirim: boolean;
  /**
   * Kirim terakhir: tanggal kirim rencana final terakhir toko ini sebelum tanggal itu (gudang dan jenis pengiriman apa
   * pun), beserta jaraknya dalam hari; `null` = belum ada rencana final sebelumnya.
   */
  kirimTerakhir: { tanggal: TanggalBisnis; selisihHari: number } | null;
  /** Pilihan operator yang tersimpan: siapa dan kapan; `null` = nilai otomatis dari kirim terakhir. */
  dipilih: { oleh: string; pada: Date } | null;
  /** Toko ini sudah punya rencana final untuk tanggal itu di gudang ini: selalu Dikirim, pilihannya tidak bisa diubah. */
  sudahFinal: boolean;
};

/** Toko aktif gudang `idGudang` yang punya pilihan dikirim pekan ini pada `tanggalKirim`. */
async function tokoBerpilihan(idGudang: number, tanggalKirim: TanggalBisnis, klien: Klien): Promise<number[]> {
  return (await jadwalKirimTokoGudang(idGudang, klien)).flatMap(({ id, aktif, jadwal, diLuarJadwal }) =>
    aktif && punyaPilihanDikirimPekanIni({ jadwal, diLuarJadwal }, tanggalKirim) ? [id] : [],
  );
}

/**
 * Keadaan pilihan dikirim pekan ini setiap toko gudang `idGudang` yang punya pilihan pada `tanggalKirim`, per id toko.
 * Toko yang tidak punya pilihan (pola lain, pengiriman di luar jadwal, bukan tanggal kirimnya, toko nonaktif) tidak ada
 * di hasil. `klien` = transaksi pemanggil bila keadaan harus konsisten dengan yang dibaca di transaksi itu (finalisasi).
 */
export async function bacaDikirimPekanIni(
  idGudang: number,
  tanggalKirim: TanggalBisnis,
  klien: Klien = db,
): Promise<Map<number, DikirimPekanIni>> {
  const idToko = await tokoBerpilihan(idGudang, tanggalKirim, klien);
  if (idToko.length === 0) return new Map();
  const [terakhir, final, pilihan] = await Promise.all([
    klien
      .select({ tokoId: rencanaFinal.tokoId, tanggal: max(rencanaFinal.tanggalKirim) })
      .from(rencanaFinal)
      .where(and(inArray(rencanaFinal.tokoId, idToko), lt(rencanaFinal.tanggalKirim, tanggalKirim)))
      .groupBy(rencanaFinal.tokoId),
    klien
      .selectDistinct({ tokoId: rencanaFinal.tokoId })
      .from(rencanaFinal)
      .where(and(eq(rencanaFinal.gudangId, idGudang), eq(rencanaFinal.tanggalKirim, tanggalKirim), inArray(rencanaFinal.tokoId, idToko))),
    klien
      .select({
        tokoId: pilihanDikirimPekanIni.tokoId,
        dikirim: pilihanDikirimPekanIni.dikirim,
        oleh: user.name,
        pada: pilihanDikirimPekanIni.dipilihPada,
      })
      .from(pilihanDikirimPekanIni)
      .innerJoin(user, eq(user.id, pilihanDikirimPekanIni.dipilihOleh))
      .where(
        and(
          eq(pilihanDikirimPekanIni.gudangId, idGudang),
          eq(pilihanDikirimPekanIni.tanggalKirim, tanggalKirim),
          inArray(pilihanDikirimPekanIni.tokoId, idToko),
        ),
      ),
  ]);
  const kirimTerakhir = new Map(terakhir.flatMap((r) => (r.tanggal === null ? [] : [[r.tokoId, parseTanggalBisnis(r.tanggal)] as const])));
  const sudahFinal = new Set(final.map((f) => f.tokoId));
  const dipilih = new Map(pilihan.map((p) => [p.tokoId, p]));
  return new Map(
    idToko.map((id): [number, DikirimPekanIni] => {
      const tanggalTerakhir = kirimTerakhir.get(id) ?? null;
      const awal = nilaiAwalDikirimPekanIni(tanggalKirim, tanggalTerakhir);
      const p = dipilih.get(id);
      const final = sudahFinal.has(id);
      return [
        id,
        {
          dikirim: final || (p?.dikirim ?? awal.dikirim),
          kirimTerakhir:
            tanggalTerakhir === null || awal.selisihHari === null ? null : { tanggal: tanggalTerakhir, selisihHari: awal.selisihHari },
          dipilih: p === undefined ? null : { oleh: p.oleh, pada: p.pada },
          sudahFinal: final,
        },
      ];
    }),
  );
}

/** Id toko gudang `idGudang` yang Tidak dikirim pekan ini pada `tanggalKirim` (tidak dihitung belum final atau tertahan). */
export async function tokoTidakDikirimPekanIni(idGudang: number, tanggalKirim: TanggalBisnis, klien: Klien = db): Promise<Set<number>> {
  const keadaan = await bacaDikirimPekanIni(idGudang, tanggalKirim, klien);
  return new Set([...keadaan].flatMap(([id, k]) => (k.dikirim ? [] : [id])));
}

/**
 * Menyimpan pilihan dikirim pekan ini toko `tokoId` di gudang `idGudang` untuk `tanggalKirim` atas nama `idPengguna`,
 * beserta waktunya (PRD A5 ▶ Revisi 2026-10-19). Ditolak tanpa menulis apa pun bila toko itu tidak punya pilihan pada
 * tanggal itu (bukan dua mingguan, bukan tanggal kirim rutinnya, atau pengiriman di luar jadwal), atau sudah punya
 * rencana final untuk tanggal itu. Pilihan berikutnya menimpa pilihan sebelumnya.
 */
export async function simpanPilihanDikirimPekanIni({
  idGudang,
  tanggalKirim,
  tokoId,
  dikirim,
  idPengguna,
}: {
  idGudang: number;
  tanggalKirim: TanggalBisnis;
  tokoId: number;
  dikirim: boolean;
  idPengguna: string;
}): Promise<{ keadaan: "berhasil" } | { keadaan: "gagal"; pesan: string }> {
  return db.transaction(async (tx) => {
    // Kunci yang sama dengan finalisasi: pilihan dan finalisasi toko di gudang ini berjalan bergantian.
    const [tujuan] = await tx.select({ id: gudang.id }).from(gudang).where(eq(gudang.id, idGudang)).for("update");
    if (!tujuan) return { keadaan: "gagal", pesan: "Gudang tidak ditemukan." };
    const keadaan = (await bacaDikirimPekanIni(idGudang, tanggalKirim, tx)).get(tokoId);
    if (keadaan === undefined) return { keadaan: "gagal", pesan: PESAN_BUKAN_DUA_MINGGUAN_RUTIN };
    if (keadaan.sudahFinal) return { keadaan: "gagal", pesan: PESAN_SUDAH_FINAL_SELALU_DIKIRIM };
    await tx
      .insert(pilihanDikirimPekanIni)
      .values({ gudangId: idGudang, tokoId, tanggalKirim, dikirim, dipilihOleh: idPengguna })
      .onConflictDoUpdate({
        target: [pilihanDikirimPekanIni.gudangId, pilihanDikirimPekanIni.tokoId, pilihanDikirimPekanIni.tanggalKirim],
        set: { dikirim, dipilihOleh: idPengguna, dipilihPada: sql`now()` },
      });
    return { keadaan: "berhasil" };
  });
}
