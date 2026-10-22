import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseTanggalBisnis, type TanggalBisnis } from "@/domain/kalender";
import { buatPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { draftRencana, hubunganTokoGudang, jadwalToko, pengirimanDiLuarJadwal, rencanaFinal } from "@/server/db/schema";

import {
  bacaDikirimPekanIni,
  PESAN_BUKAN_DUA_MINGGUAN_RUTIN,
  PESAN_SUDAH_FINAL_SELALU_DIKIRIM,
  simpanPilihanDikirimPekanIni,
} from "./dikirim-pekan-ini";
import { bacaDraftRencana, hitungDraftRencana } from "./draft-rencana";
import { finalisasiRencanaToko, PESAN_TIDAK_DIKIRIM_PEKAN_INI } from "./rencana-final";
import { simpanStokToko } from "./stok-draft";
import { tanggalKirimTerdekat } from "./tanggal-kirim-terdekat";
import { siapkanTokoSmbUji } from "./uji-bantu-cakupan";
import { buatGudangUji, buatTokoUji, hapusGudangUji, rencanaFinalUji } from "./uji-bantu";

// T134 (PRD A5 ▶ Revisi 2026-10-19, "Dikirim pekan ini"): toko dua mingguan pada tanggal kirim rutinnya punya pilihan
// Dikirim / Tidak dikirim pekan ini. Nilai awal dari kirim terakhir (rencana final terakhir toko itu sebelum tanggal draft,
// gudang mana pun, jenis apa pun): Dikirim bila belum ada atau ≥ 14 hari, selain itu Tidak dikirim pekan ini. Pilihan operator
// disimpan per gudang + toko + tanggal kirim dan tetap berlaku setelah draft dihitung ulang. Toko yang sudah final untuk
// tanggal itu selalu Dikirim. Toko Tidak dikirim pekan ini tidak bisa difinalisasi dan tidak dihitung belum final.
// T135: tanggal kirim rutin dua mingguan = setiap tanggal yang jatuh pada hari kirimnya, tanpa tanggal jangkar. Contoh BXC:
// dua mingguan Rabu (H−1) → setiap Rabu (21-10, 28-10, 04-11, 11-11-2026) adalah tanggal kirim rutin.

const t = parseTanggalBisnis;
const RABU_21 = t("2026-10-21");
const RABU_28 = t("2026-10-28");
const RABU_04_11 = t("2026-11-04");
const RABU_11_11 = t("2026-11-11");
/** Bukan hari kirim BXC. */
const SELASA_27 = t("2026-10-27");
/** "Hari ini" untuk tanggal kirim terdekat: Kamis sebelum Rabu 28-10. */
const KAMIS_22 = t("2026-10-22");

let idAdmin: string;
let idOperator: string;
let gudang: { id: number; nama: string };
/** Gudang lain: kirim terakhir dibaca dari rencana final gudang mana pun. */
let gudangLain: { id: number; nama: string };
let bxc: { id: number; nama: string };
let kodeProduk: string;
/** Toko pola mingguan Rabu di gudang yang sama: tidak punya pilihan. */
let tokoMingguan: { id: number; nama: string };

const keadaan = async (tanggal: TanggalBisnis) => (await bacaDikirimPekanIni(gudang.id, tanggal)).get(bxc.id);
const hitung = async (tanggal: TanggalBisnis) =>
  expect(await hitungDraftRencana({ idGudang: gudang.id, tanggalKirim: tanggal, idPengguna: idOperator })).toMatchObject({
    keadaan: "berhasil",
  });
const tokoDraft = async (tanggal: TanggalBisnis, tokoId: number) =>
  (await bacaDraftRencana(gudang.id, tanggal))?.toko.find((x) => x.id === tokoId);
const pilih = (tanggal: TanggalBisnis, dikirim: boolean, tokoId = bxc.id) =>
  simpanPilihanDikirimPekanIni({ idGudang: gudang.id, tanggalKirim: tanggal, tokoId, dikirim, idPengguna: idOperator });

async function finalisasiBxc(tanggal: TanggalBisnis) {
  const toko = await tokoDraft(tanggal, bxc.id);
  if (toko === undefined) throw new Error("BXC tidak ada di draft.");
  return finalisasiRencanaToko({
    idGudang: gudang.id,
    tanggalKirim: tanggal,
    tokoId: bxc.id,
    idPengguna: idOperator,
    versiDilihat: toko.versi,
  });
}

beforeAll(async () => {
  idAdmin = (await buatPenggunaUji("admin")).id;
  idOperator = (await buatPenggunaUji("viewer")).id;
  [gudang, gudangLain] = [await buatGudangUji(), await buatGudangUji()];
  ({ toko: bxc, kodeProduk } = await siapkanTokoSmbUji({ idGudang: gudang.id, idAdmin }));
  await db
    .update(jadwalToko)
    .set({ pola: "dua-mingguan", hariKirim: [{ hari: "Rabu", persiapanHari: 1 }] })
    .where(eq(jadwalToko.tokoId, bxc.id));
  tokoMingguan = await buatTokoUji();
  await db.insert(hubunganTokoGudang).values({ tokoId: tokoMingguan.id, gudangId: gudang.id });
  await db
    .insert(jadwalToko)
    .values({ tokoId: tokoMingguan.id, pola: "mingguan", hariKirim: [{ hari: "Rabu", persiapanHari: 1 }], dibuatOleh: idAdmin });
  await hitung(RABU_28);
}, 120_000);

afterAll(async () => {
  await db.delete(draftRencana).where(inArray(draftRencana.gudangId, [gudang.id, gudangLain.id]));
  await hapusGudangUji(gudang.id, gudangLain.id);
});

describe("nilai awal dari kirim terakhir", () => {
  it("belum ada rencana final sebelumnya → Dikirim, kirim terakhir kosong, belum dipilih operator", async () => {
    expect(await keadaan(RABU_28)).toEqual({ dikirim: true, kirimTerakhir: null, dipilih: null, sudahFinal: false });
  });

  it("setiap Rabu adalah tanggal kirim rutin BXC dengan pilihan, juga pekan yang dulu bukan pekan jangkar (21-10, 04-11-2026)", async () => {
    for (const tanggal of [RABU_21, RABU_04_11]) {
      expect(await keadaan(tanggal)).toEqual({ dikirim: true, kirimTerakhir: null, dipilih: null, sudahFinal: false });
    }
  });

  it("toko pola lain dan tanggal yang bukan tanggal kirim rutin tidak punya pilihan", async () => {
    expect((await bacaDikirimPekanIni(gudang.id, RABU_28)).has(tokoMingguan.id)).toBe(false);
    expect(await keadaan(SELASA_27)).toBeUndefined();
  });

  it("draft menampilkan keadaan pilihan toko dua mingguan; toko pola lain tanpa pilihan", async () => {
    expect((await tokoDraft(RABU_28, bxc.id))?.dikirimPekanIni).toEqual({
      dikirim: true,
      kirimTerakhir: null,
      dipilih: null,
      sudahFinal: false,
    });
    expect((await tokoDraft(RABU_28, tokoMingguan.id))?.dikirimPekanIni).toBeNull();
  });

  it("rencana final 21-10-2026 dibuat (gudang lain) → nilai awal 28-10 berubah menjadi Tidak dikirim pekan ini (7 hari); 11-11 tetap Dikirim (21 hari)", async () => {
    await rencanaFinalUji({ idGudang: gudangLain.id, idToko: bxc.id, tanggalKirim: RABU_21, idPengguna: idAdmin });
    expect(await keadaan(RABU_28)).toEqual({
      dikirim: false,
      kirimTerakhir: { tanggal: RABU_21, selisihHari: 7 },
      dipilih: null,
      sudahFinal: false,
    });
    expect(await keadaan(RABU_11_11)).toMatchObject({ dikirim: true, kirimTerakhir: { tanggal: RABU_21, selisihHari: 21 } });
    expect((await tokoDraft(RABU_28, bxc.id))?.dikirimPekanIni).toMatchObject({ dikirim: false });
  });
});

describe("toko Tidak dikirim pekan ini", () => {
  it("tidak bisa difinalisasi (diperiksa di server), walaupun semua barisnya siap", async () => {
    expect(
      await simpanStokToko({ idGudang: gudang.id, tanggalKirim: RABU_28, tokoId: bxc.id, stok: [{ kodeProduk, stokAkhir: 4 }] }),
    ).toEqual({
      keadaan: "berhasil",
    });
    expect((await tokoDraft(RABU_28, bxc.id))?.jumlahTertahan).toBe(0);
    expect(await finalisasiBxc(RABU_28)).toEqual({ keadaan: "gagal", pesan: PESAN_TIDAK_DIKIRIM_PEKAN_INI });
    expect(await db.select().from(rencanaFinal).where(eq(rencanaFinal.tanggalKirim, RABU_28))).toEqual([]);
  });

  it("tidak dihitung belum final untuk tanggal kirim terdekat; toko pola lain tetap dihitung", async () => {
    expect(await tanggalKirimTerdekat(gudang.id, KAMIS_22)).toEqual({ tanggalKirim: RABU_28, jumlahBelumFinal: 1 });
  });
});

describe("pilihan operator", () => {
  it("Dikirim dipilih operator: tersimpan beserta siapa dan kapan, mengalahkan nilai awal, dan dihitung belum final lagi", async () => {
    const sebelum = new Date();
    expect(await pilih(RABU_28, true)).toEqual({ keadaan: "berhasil" });
    const hasil = await keadaan(RABU_28);
    expect(hasil).toMatchObject({
      dikirim: true,
      kirimTerakhir: { tanggal: RABU_21, selisihHari: 7 },
      dipilih: { oleh: "Uji viewer" },
      sudahFinal: false,
    });
    expect(hasil?.dipilih?.pada.getTime()).toBeGreaterThanOrEqual(sebelum.getTime() - 1000);
    expect(await tanggalKirimTerdekat(gudang.id, KAMIS_22)).toEqual({ tanggalKirim: RABU_28, jumlahBelumFinal: 2 });
  });

  it("pilihan tetap berlaku setelah draft dihitung ulang", async () => {
    await hitung(RABU_28);
    expect((await tokoDraft(RABU_28, bxc.id))?.dikirimPekanIni).toMatchObject({ dikirim: true, dipilih: { oleh: "Uji viewer" } });
  });

  it("setelah diubah menjadi Dikirim, toko bisa difinalisasi seperti biasa; lalu selalu Dikirim dan pilihannya tidak bisa diubah", async () => {
    expect(await finalisasiBxc(RABU_28)).toMatchObject({ keadaan: "berhasil" });
    expect(await keadaan(RABU_28)).toMatchObject({ dikirim: true, sudahFinal: true });
    expect(await pilih(RABU_28, false)).toEqual({ keadaan: "gagal", pesan: PESAN_SUDAH_FINAL_SELALU_DIKIRIM });
    expect(await keadaan(RABU_28)).toMatchObject({ dikirim: true, sudahFinal: true });
    expect(await tanggalKirimTerdekat(gudang.id, KAMIS_22)).toEqual({ tanggalKirim: RABU_28, jumlahBelumFinal: 1 });
  });

  it("Tidak dikirim pekan ini dipilih operator walaupun nilai awalnya Dikirim (kirim terakhir 28-10, 14 hari)", async () => {
    expect(await keadaan(RABU_11_11)).toMatchObject({ dikirim: true, kirimTerakhir: { tanggal: RABU_28, selisihHari: 14 }, dipilih: null });
    expect(await pilih(RABU_11_11, false)).toEqual({ keadaan: "berhasil" });
    expect(await keadaan(RABU_11_11)).toMatchObject({ dikirim: false, dipilih: { oleh: "Uji viewer" } });
  });

  it("ditolak untuk toko pola lain dan tanggal yang bukan tanggal kirim rutin", async () => {
    expect(await pilih(RABU_28, false, tokoMingguan.id)).toEqual({ keadaan: "gagal", pesan: PESAN_BUKAN_DUA_MINGGUAN_RUTIN });
    expect(await pilih(SELASA_27, false)).toEqual({ keadaan: "gagal", pesan: PESAN_BUKAN_DUA_MINGGUAN_RUTIN });
    expect((await bacaDikirimPekanIni(gudang.id, RABU_28)).has(tokoMingguan.id)).toBe(false);
  });

  it("ditolak untuk pengiriman di luar jadwal toko dua mingguan, yang tidak punya pilihan", async () => {
    const kamis = t("2026-10-29");
    await db.insert(pengirimanDiLuarJadwal).values({
      gudangId: gudang.id,
      tokoId: bxc.id,
      jenis: "tambahan",
      tanggalKirim: kamis,
      persiapanHari: 1,
      alasan: "Uji T134",
      status: "berlaku",
      diusulkanOleh: idOperator,
    });
    expect(await pilih(kamis, false)).toEqual({ keadaan: "gagal", pesan: PESAN_BUKAN_DUA_MINGGUAN_RUTIN });
    expect(await keadaan(kamis)).toBeUndefined();
    await hitung(kamis);
    expect(await tokoDraft(kamis, bxc.id)).toMatchObject({ diLuarJadwal: { jenis: "tambahan" }, dikirimPekanIni: null });
  });
});
