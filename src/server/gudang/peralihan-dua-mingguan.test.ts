import { eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { tanggalWib } from "@/app/admin/impor/format";
import { geserHari, namaHari } from "@/domain/kalender";
import { buatPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { hubunganTokoGudang, jadwalToko, pengirimanDiLuarJadwal } from "@/server/db/schema";
import { pernyataanMigrasi } from "@/server/db/uji-bantu";

import { buatTokoUji, idGudangUji, rencanaFinalUji } from "./uji-bantu";

// T135 — PRD A5 ▶ Revisi 2026-10-19, Peralihan: migrasi 0030 membatalkan otomatis satu kali pengiriman di luar jadwal toko
// dua mingguan yang tanggal kirimnya kini menjadi tanggal kirim rutin (jatuh pada hari kirimnya), masih Menunggu atau
// Berlaku, belum lewat (WIB), dan belum punya rencana final. Alasan "Tanggal itu sudah menjadi tanggal kirim rutin", pembatal
// kosong (sistem). Database test sudah dimigrasi dari kosong, jadi pernyataan UPDATE migrasi itu dijalankan lagi di atas
// data "sebelum migrasi" buatan test ini. Tanggal dihitung dari hari ini (WIB), sama seperti migrasinya.

/** Pernyataan UPDATE `pengiriman_di_luar_jadwal` di migrasi 0030. */
function pernyataanPembatalan() {
  const pernyataan = pernyataanMigrasi("0030_dua_mingguan_tanpa_jangkar.sql").filter((p) =>
    p.startsWith('UPDATE "pengiriman_di_luar_jadwal"'),
  );
  expect(pernyataan).toHaveLength(1);
  return pernyataan[0];
}

describe("migrasi peralihan pola dua mingguan", () => {
  it('pengiriman di luar jadwal toko dua mingguan pada hari kirimnya, menunggu/berlaku, belum lewat, belum final → Dibatalkan "Tanggal itu sudah menjadi tanggal kirim rutin"; yang lain tidak tersentuh', async () => {
    const admin = await buatPenggunaUji("admin");
    const cibubur = await idGudangUji("Gudang Cibubur");
    const hariIni = tanggalWib(new Date());
    const hariKirim = namaHari(hariIni);
    const hari = (jarak: number) => geserHari(hariIni, jarak);

    const [duaMingguan, mingguan, bekasDuaMingguan] = [await buatTokoUji(), await buatTokoUji(), await buatTokoUji()];
    await db.insert(hubunganTokoGudang).values([duaMingguan, mingguan, bekasDuaMingguan].map((t) => ({ tokoId: t.id, gudangId: cibubur })));
    // Jadwal dua mingguan lama masih menyimpan tanggal jangkar; hari kirimnya = hari ini.
    await db.insert(jadwalToko).values([
      {
        tokoId: duaMingguan.id,
        pola: "dua-mingguan",
        hariKirim: [{ hari: hariKirim, persiapanHari: 1 }],
        tanggalJangkar: hari(-7),
        dibuatOleh: admin.id,
      },
      { tokoId: mingguan.id, pola: "mingguan", hariKirim: [{ hari: namaHari(hari(1)), persiapanHari: 0 }], dibuatOleh: admin.id },
      // Jadwal dua mingguan yang sudah nonaktif tidak dihitung; jadwal aktifnya mingguan di hari lain.
      {
        tokoId: bekasDuaMingguan.id,
        pola: "dua-mingguan",
        hariKirim: [{ hari: hariKirim, persiapanHari: 1 }],
        tanggalJangkar: hari(-7),
        status: "nonaktif",
        dibuatOleh: admin.id,
        dinonaktifkanOleh: admin.id,
        dinonaktifkanPada: new Date(),
      },
      { tokoId: bekasDuaMingguan.id, pola: "mingguan", hariKirim: [{ hari: namaHari(hari(1)), persiapanHari: 0 }], dibuatOleh: admin.id },
    ]);

    const isi = { gudangId: cibubur, jenis: "tambahan" as const, persiapanHari: 1 as const, alasan: "uji", diusulkanOleh: admin.id };
    const berlaku = { status: "berlaku" as const, diputuskanOleh: admin.id, diputuskanPada: new Date() };
    const daftar = await db
      .insert(pengirimanDiLuarJadwal)
      .values([
        // Dibatalkan: menunggu hari ini, dan pindah berlaku sepekan lagi (tanggal rutin yang dipindah kembali).
        { ...isi, tokoId: duaMingguan.id, tanggalKirim: hariIni },
        { ...isi, ...berlaku, tokoId: duaMingguan.id, jenis: "pindah", tanggalKirim: hari(7), tanggalRutinDipindah: hari(14) },
        // Tidak tersentuh: bukan hari kirimnya, sudah lewat, sudah final, ditolak, toko bukan dua mingguan.
        { ...isi, ...berlaku, tokoId: duaMingguan.id, tanggalKirim: hari(1) },
        { ...isi, ...berlaku, tokoId: duaMingguan.id, tanggalKirim: hari(-7) },
        { ...isi, ...berlaku, tokoId: duaMingguan.id, tanggalKirim: hari(21) },
        {
          ...isi,
          tokoId: duaMingguan.id,
          tanggalKirim: hari(28),
          status: "ditolak",
          diputuskanOleh: admin.id,
          diputuskanPada: new Date(),
          alasanPenolakan: "uji",
        },
        { ...isi, ...berlaku, tokoId: mingguan.id, tanggalKirim: hari(7) },
        { ...isi, ...berlaku, tokoId: bekasDuaMingguan.id, tanggalKirim: hari(7) },
      ])
      .returning();
    await rencanaFinalUji({ idGudang: cibubur, idToko: duaMingguan.id, tanggalKirim: hari(21), idPengguna: admin.id });
    const [menungguHariIni, pindahPekanDepan, ...tidakTersentuh] = daftar;

    await db.execute(sql.raw(pernyataanPembatalan()));

    const sesudah = await db
      .select()
      .from(pengirimanDiLuarJadwal)
      .where(
        inArray(
          pengirimanDiLuarJadwal.id,
          daftar.map((p) => p.id),
        ),
      );
    const baca = (id: number) => sesudah.find((p) => p.id === id);
    for (const { id } of [menungguHariIni, pindahPekanDepan]) {
      expect(baca(id)).toMatchObject({
        status: "dibatalkan",
        alasanPembatalan: "Tanggal itu sudah menjadi tanggal kirim rutin",
        dibatalkanOleh: null,
      });
      expect(baca(id)?.dibatalkanPada).toBeInstanceOf(Date);
    }
    for (const p of tidakTersentuh) expect(baca(p.id)).toEqual(p);

    // Jadwal lama beserta tanggal jangkarnya tetap ada.
    const [jadwal] = await db.select().from(jadwalToko).where(eq(jadwalToko.tokoId, duaMingguan.id));
    expect(jadwal).toMatchObject({ status: "aktif", pola: "dua-mingguan", tanggalJangkar: hari(-7) });
  });
});
