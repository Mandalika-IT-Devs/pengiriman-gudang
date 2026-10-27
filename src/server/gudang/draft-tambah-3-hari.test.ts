import { readFileSync } from "node:fs";
import { join } from "node:path";

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseTanggalBisnis, type TanggalBisnis } from "@/domain/kalender";
import { buatPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { draftRencana, jadwalToko, pengirimanDiLuarJadwal } from "@/server/db/schema";

import { bacaDraftRencana, bacaRingkasanDraft, hitungDraftRencana } from "./draft-rencana";
import { setujuiPengirimanDiLuarJadwal, usulkanPengirimanDiLuarJadwal } from "./pengiriman-di-luar-jadwal";
import { bacaRencanaFinal, finalisasiRencanaToko } from "./rencana-final";
import { simpanStokToko } from "./stok-draft";
import { bersihkanTokoSmbUji, siapkanTokoSmbUji } from "./uji-bantu-cakupan";
import { idGudangUji } from "./uji-bantu";

// T143 — PRD A5 ▶ Keputusan 2026-10-27 dan A6 ▶ Keputusan 2026-10-27: toko yang jadwal tetapnya bertanda "Tambah 3 hari
// cakupan" mendapat cakupan H−p sampai H+L−1+3 di setiap pengirimannya, rutin maupun di luar jadwal. Draft menyimpan tanda
// itu; tanda yang berubah sesudah draft dihitung menandai draft perlu dihitung ulang, dan rencana final menyimpannya di
// snapshot jadwal. Checkbox admin dibuat di T144, jadi tanda di test ini diubah langsung di data.

type KasusCakupan = {
  nama: string;
  diLuarJadwal: { tanggalKirim: string; persiapanHari: 0 | 1 | 2; tanggalRutinDipindah: string | null }[];
  tanggalKirim: string;
  persiapanHari: number;
  panjangCakupan: number;
  awalCakupan: string;
  akhirCakupan: string;
  jumlahHari: number;
  kirimanSebelumnyaBelumSampai: string | null;
};

const golden = JSON.parse(readFileSync(join(import.meta.dirname, "../../../tests/golden/tambah-3-hari-cakupan.json"), "utf8")) as {
  kasusContohPemilik: {
    tanggalKirim: string;
    persiapanHari: number;
    panjangCakupan: number;
    tanggalCakupan: { tanggal: string }[];
    kebutuhan: number;
    jumlahKirim: { stokAkhir: number; jumlahKirim: number };
    tanpaTambahan: { akhirCakupan: string; jumlahHari: number; kebutuhan: number; jumlahKirim: number };
  };
  kasusCakupan: KasusCakupan[];
};

const contoh = golden.kasusContohPemilik;
const KAMIS = parseTanggalBisnis(contoh.tanggalKirim);
/** Tanggal "hari ini" untuk syarat usulan: sebelum semua tanggal kirim contoh. */
const HARI_INI = parseTanggalBisnis("2026-10-01");

let idAdmin: string;
let idOperator: string;
let cibubur: number;
let toko: { id: number; nama: string };
let kodeProduk: string;

beforeAll(async () => {
  idAdmin = (await buatPenggunaUji("admin")).id;
  idOperator = (await buatPenggunaUji("viewer")).id;
  cibubur = await idGudangUji("Gudang Cibubur");
  ({ toko, kodeProduk } = await siapkanTokoSmbUji({ idGudang: cibubur, idAdmin }));
}, 120_000);

afterAll(async () => {
  await db.delete(draftRencana).where(eq(draftRencana.gudangId, cibubur));
  await db.delete(pengirimanDiLuarJadwal).where(eq(pengirimanDiLuarJadwal.tokoId, toko.id));
  await bersihkanTokoSmbUji({ idGudang: cibubur, idToko: toko.id });
});

const hitung = async (tanggalKirim: TanggalBisnis) =>
  expect(await hitungDraftRencana({ idGudang: cibubur, tanggalKirim, idPengguna: idOperator })).toMatchObject({ keadaan: "berhasil" });
const tokoDi = async (tanggalKirim: TanggalBisnis) => (await bacaDraftRencana(cibubur, tanggalKirim))?.toko.find((t) => t.id === toko.id);
const ubahJadwal = (isi: Partial<typeof jadwalToko.$inferInsert>) =>
  db
    .update(jadwalToko)
    .set(isi)
    .where(and(eq(jadwalToko.tokoId, toko.id), eq(jadwalToko.status, "aktif")));

describe("draft rencana toko bertanda: mingguan Kamis (H−1), kirim Kamis 2026-10-29 (contoh pemilik)", () => {
  beforeAll(async () => {
    await ubahJadwal({ pola: "mingguan", hariKirim: [{ hari: "Kamis", persiapanHari: 1 }], tambah3HariCakupan: true });
  });

  it("11 tanggal cakupan 2026-10-28 s.d. 2026-11-07, L tetap 7, kebutuhan 63", async () => {
    await hitung(KAMIS);
    const hasil = await tokoDi(KAMIS);
    expect(hasil).toMatchObject({ persiapanHari: contoh.persiapanHari, panjangCakupan: contoh.panjangCakupan, tambah3HariCakupan: true });
    expect(hasil?.cakupan?.map((c) => c.tanggal)).toEqual(contoh.tanggalCakupan.map((c) => c.tanggal));
    expect(hasil?.baris.find((b) => b.kodeProduk === kodeProduk)).toMatchObject({ klasifikasi: "otomatis", kebutuhan: contoh.kebutuhan });
    const ringkasan = await bacaRingkasanDraft(cibubur, KAMIS, toko.id);
    expect(ringkasan?.tokoDibuka).toMatchObject({ id: toko.id, tambah3HariCakupan: true });
  });

  it("stok akhir 20 → jumlah kirim 56", async () => {
    const stok = [{ kodeProduk, stokAkhir: contoh.jumlahKirim.stokAkhir }];
    expect(await simpanStokToko({ idGudang: cibubur, tanggalKirim: KAMIS, tokoId: toko.id, stok })).toEqual({ keadaan: "berhasil" });
    expect((await tokoDi(KAMIS))?.baris.find((b) => b.kodeProduk === kodeProduk)).toMatchObject({
      jumlahKirim: contoh.jumlahKirim.jumlahKirim,
    });
  });

  it("tanda dilepas langsung di data → draft perlu dihitung ulang, stok yang sudah diisi tetap ada", async () => {
    await ubahJadwal({ tambah3HariCakupan: false });
    expect((await bacaDraftRencana(cibubur, KAMIS))?.perluDihitungUlang).toEqual(["jadwal"]);
    expect(await tokoDi(KAMIS)).toMatchObject({ perluDihitungUlang: ["jadwal"], tambah3HariCakupan: true });

    await hitung(KAMIS);
    const hasil = await tokoDi(KAMIS);
    const { tanpaTambahan } = contoh;
    expect(hasil).toMatchObject({ perluDihitungUlang: [] });
    expect(hasil).not.toHaveProperty("tambah3HariCakupan");
    expect([hasil?.cakupan?.length, hasil?.cakupan?.at(-1)?.tanggal]).toEqual([tanpaTambahan.jumlahHari, tanpaTambahan.akhirCakupan]);
    expect(hasil?.baris.find((b) => b.kodeProduk === kodeProduk)).toMatchObject({
      kebutuhan: tanpaTambahan.kebutuhan,
      stokAkhir: contoh.jumlahKirim.stokAkhir,
      jumlahKirim: tanpaTambahan.jumlahKirim,
    });
  });

  it("tanda dicentang lagi langsung di data → draft perlu dihitung ulang lagi", async () => {
    await ubahJadwal({ tambah3HariCakupan: true });
    expect(await tokoDi(KAMIS)).toMatchObject({ perluDihitungUlang: ["jadwal"] });
  });

  it("rencana final menyimpan tanda di snapshot jadwal beserta cakupan 11 hari", async () => {
    await hitung(KAMIS);
    const versiDilihat = (await tokoDi(KAMIS))?.versi ?? "";
    const hasil = await finalisasiRencanaToko({
      idGudang: cibubur,
      tanggalKirim: KAMIS,
      tokoId: toko.id,
      idPengguna: idOperator,
      versiDilihat,
    });
    if (hasil.keadaan !== "berhasil") throw new Error(hasil.pesan);
    const rencana = await bacaRencanaFinal(cibubur, hasil.idRencana);
    expect(rencana?.jadwal).toMatchObject({ pola: "mingguan", persiapanHari: 1, panjangCakupan: 7, tambah3HariCakupan: true });
    expect(rencana?.kalender.cakupan.map((c) => c.tanggal)).toEqual(contoh.tanggalCakupan.map((c) => c.tanggal));
  });
});

describe("pengiriman di luar jadwal toko bertanda juga mendapat 3 hari tambahan (BOTANI, golden kasusCakupan)", () => {
  const kasusBotani = golden.kasusCakupan.filter((k) => k.nama.startsWith("BOTANI"));

  beforeAll(async () => {
    await db.delete(draftRencana).where(eq(draftRencana.gudangId, cibubur));
    await ubahJadwal({
      pola: "2x-seminggu",
      hariKirim: [
        { hari: "Senin", persiapanHari: 0 },
        { hari: "Kamis", persiapanHari: 1 },
      ],
      tambah3HariCakupan: true,
    });
    const [tambahan] = kasusBotani[0].diLuarJadwal;
    const usul = await usulkanPengirimanDiLuarJadwal({
      idGudang: cibubur,
      isian: {
        jenis: "tambahan",
        idToko: toko.id,
        tanggalKirim: parseTanggalBisnis(tambahan.tanggalKirim),
        persiapanHari: tambahan.persiapanHari,
        tanggalRutinDipindah: null,
        alasan: "Stok BOTANI menipis jelang promo",
      },
      idPengguna: idOperator,
      hariIni: HARI_INI,
    });
    if (usul.keadaan !== "berhasil") throw new Error(usul.pesan);
    const [{ id }] = await db
      .select({ id: pengirimanDiLuarJadwal.id })
      .from(pengirimanDiLuarJadwal)
      .where(and(eq(pengirimanDiLuarJadwal.tokoId, toko.id), eq(pengirimanDiLuarJadwal.status, "menunggu")));
    const setuju = await setujuiPengirimanDiLuarJadwal({ id, idPengguna: idAdmin, hariIni: HARI_INI });
    if (setuju.keadaan !== "berhasil") throw new Error(setuju.pesan);
  });

  it("kasus BOTANI di fixture ada (rutin Senin, tambahan Selasa, rutin Kamis)", () => {
    expect(kasusBotani).toHaveLength(3);
  });

  for (const kasus of kasusBotani) {
    it(`${kasus.nama}: ${kasus.awalCakupan} s.d. ${kasus.akhirCakupan}, ${kasus.jumlahHari} hari`, async () => {
      const tanggalKirim = parseTanggalBisnis(kasus.tanggalKirim);
      await hitung(tanggalKirim);
      const hasil = await tokoDi(tanggalKirim);
      expect(hasil).toMatchObject({
        persiapanHari: kasus.persiapanHari,
        panjangCakupan: kasus.panjangCakupan,
        tambah3HariCakupan: true,
        kirimanSebelumnyaBelumSampai: kasus.kirimanSebelumnyaBelumSampai,
      });
      const cakupan = hasil?.cakupan?.map((c) => c.tanggal) ?? [];
      expect([cakupan[0], cakupan.at(-1), cakupan.length]).toEqual([kasus.awalCakupan, kasus.akhirCakupan, kasus.jumlahHari]);
    });
  }

  it("pengiriman di luar jadwal Selasa tercatat sebagai tambahan di draft", async () => {
    expect((await tokoDi(parseTanggalBisnis("2026-10-20")))?.diLuarJadwal).toMatchObject({ jenis: "tambahan" });
  });
});
