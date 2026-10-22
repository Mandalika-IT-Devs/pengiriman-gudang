import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseTanggalBisnis, type TanggalBisnis } from "@/domain/kalender";
import { buatPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { draftRencana, pengirimanDiLuarJadwal } from "@/server/db/schema";

import { bacaDraftRencana, hitungDraftRencana } from "./draft-rencana";
import { aturJadwalTetap } from "./jadwal";
import { bacaRencanaFinal, finalisasiRencanaToko } from "./rencana-final";
import { simpanStokToko } from "./stok-draft";
import { siapkanTokoSmbUji } from "./uji-bantu-cakupan";
import { buatGudangUji, hapusGudangUji } from "./uji-bantu";

// T135 — PRD A5 ▶ Revisi 2026-10-19 (Jadwal tetap dua mingguan, Cakupan) dan A6 ▶ Revisi 2026-10-19: toko dua mingguan
// tanpa tanggal jangkar ikut di draft setiap pekan pada hari kirimnya, dan setiap pengirimannya, rutin maupun di luar jadwal,
// memakai L = 14. Pengiriman di luar jadwal tidak memendekkan L pengiriman dua mingguan sebelumnya. Contoh BXC: dua mingguan
// Rabu (H−1); Rabu 21-10, 28-10, dan 04-11-2026 adalah tanggal kirim rutin.

const t = parseTanggalBisnis;
const RABU = ["2026-10-21", "2026-10-28", "2026-11-04"].map(t);
const JUMAT_23 = t("2026-10-23");
/** "Hari ini" (WIB) saat jadwal disimpan: sebelum semua tanggal kirim di atas. */
const HARI_INI = t("2026-10-19");

let idOperator: string;
let gudang: { id: number; nama: string };
let bxc: { id: number; nama: string };
let kodeProduk: string;

const hitung = async (tanggal: TanggalBisnis) =>
  expect(await hitungDraftRencana({ idGudang: gudang.id, tanggalKirim: tanggal, idPengguna: idOperator })).toMatchObject({
    keadaan: "berhasil",
  });
const tokoDraft = async (tanggal: TanggalBisnis) => (await bacaDraftRencana(gudang.id, tanggal))?.toko.find((x) => x.id === bxc.id);

beforeAll(async () => {
  const idAdmin = (await buatPenggunaUji("admin")).id;
  idOperator = (await buatPenggunaUji("viewer")).id;
  gudang = await buatGudangUji();
  ({ toko: bxc, kodeProduk } = await siapkanTokoSmbUji({ idGudang: gudang.id, idAdmin }));
  // Admin menyimpan jadwal dua mingguan Rabu (H−1) tanpa tanggal jangkar.
  expect(
    await aturJadwalTetap({
      idGudang: gudang.id,
      idToko: bxc.id,
      masukan: { pola: "dua-mingguan", hariKirim: [{ hari: "Rabu", persiapan: "H-1" }] },
      idPengguna: idAdmin,
      hariIni: HARI_INI,
    }),
  ).toEqual({ keadaan: "berhasil" });
}, 120_000);

afterAll(async () => {
  await db.delete(draftRencana).where(inArray(draftRencana.gudangId, [gudang.id]));
  await hapusGudangUji(gudang.id);
});

describe("toko dua mingguan di draft setiap pekan (PRD A5 ▶ Revisi 2026-10-19)", () => {
  it("BXC ikut di draft setiap Rabu (21-10, 28-10, 04-11-2026) dengan p = 1, L = 14, cakupan 15 hari Selasa–Selasa", async () => {
    for (const tanggal of RABU) {
      await hitung(tanggal);
      const toko = await tokoDraft(tanggal);
      expect(toko, tanggal).toMatchObject({ polaJadwal: "dua-mingguan", persiapanHari: 1, panjangCakupan: 14, diLuarJadwal: null });
      expect(toko?.cakupan, tanggal).toHaveLength(15);
    }
    const cakupan = (await tokoDraft(RABU[0]!))?.cakupan?.map((c) => c.tanggal);
    expect([cakupan?.[0], cakupan?.at(-1)]).toEqual(["2026-10-20", "2026-11-03"]);
  });

  it("tambahan Jumat 23-10-2026 berlaku: Jumat L = 14, dan draft Rabu 21-10 tidak berubah (L tetap 14, tidak perlu dihitung ulang)", async () => {
    await db.insert(pengirimanDiLuarJadwal).values({
      gudangId: gudang.id,
      tokoId: bxc.id,
      jenis: "tambahan",
      tanggalKirim: JUMAT_23,
      persiapanHari: 1,
      alasan: "Uji T135",
      status: "berlaku",
      diusulkanOleh: idOperator,
    });
    expect(await tokoDraft(RABU[0]!)).toMatchObject({ panjangCakupan: 14, perluDihitungUlang: [] });

    await hitung(JUMAT_23);
    const jumat = await tokoDraft(JUMAT_23);
    expect(jumat).toMatchObject({ persiapanHari: 1, panjangCakupan: 14, diLuarJadwal: { jenis: "tambahan" }, dikirimPekanIni: null });
    const cakupan = jumat?.cakupan?.map((c) => c.tanggal);
    expect([cakupan?.length, cakupan?.[0], cakupan?.at(-1)]).toEqual([15, "2026-10-22", "2026-11-05"]);

    await hitung(RABU[0]!);
    expect(await tokoDraft(RABU[0]!)).toMatchObject({ panjangCakupan: 14, perluDihitungUlang: [] });
  });

  it("rencana final BXC Rabu 21-10-2026 menyimpan snapshot jadwal tanpa tanggal jangkar dan L = 14", async () => {
    expect(
      await simpanStokToko({ idGudang: gudang.id, tanggalKirim: RABU[0]!, tokoId: bxc.id, stok: [{ kodeProduk, stokAkhir: 4 }] }),
    ).toEqual({
      keadaan: "berhasil",
    });
    const versiDilihat = (await tokoDraft(RABU[0]!))?.versi ?? "";
    const hasil = await finalisasiRencanaToko({
      idGudang: gudang.id,
      tanggalKirim: RABU[0]!,
      tokoId: bxc.id,
      idPengguna: idOperator,
      versiDilihat,
    });
    if (hasil.keadaan !== "berhasil") throw new Error(hasil.pesan);
    const rencana = await bacaRencanaFinal(gudang.id, hasil.idRencana);
    expect(rencana?.jadwal).toMatchObject({
      pola: "dua-mingguan",
      hariKirim: [{ hari: "Rabu", persiapanHari: 1 }],
      tanggalJangkar: null,
      persiapanHari: 1,
      panjangCakupan: 14,
    });
  });
});
