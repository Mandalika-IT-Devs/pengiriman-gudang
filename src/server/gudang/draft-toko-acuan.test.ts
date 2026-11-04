import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseTanggalBisnis, type KategoriDasar } from "@/domain/kalender";
import { buatPenggunaUji } from "@/server/auth/uji-bantu";
import { batalkanPerubahanKategori, buatPerubahanKategori } from "@/server/kalender/perubahan-kategori";

import { bacaDraftRencana, bacaRingkasanDraft, hitungDraftRencana } from "./draft-rencana";
import { MASALAH_TANPA_VARIAN, masalahTanpaVarian } from "./masalah-draft";
import { tetapkanPeriodeSumber } from "./periode-sumber";
import { finalisasiRencanaToko, PESAN_TANPA_VARIAN } from "./rencana-final";
import { simpanStokToko } from "./stok-draft";
import { bersihkanTokoAcuanUji, siapkanTokoAcuanUji } from "./uji-bantu-toko-acuan";
import { idGudangUji } from "./uji-bantu";

// T151 — PRD A5 ▶ Keputusan 2026-11-04 (toko acuan: Perhitungan) dan A6 ▶ Keputusan 2026-11-04: untuk toko yang jadwal
// tetapnya memakai toko acuan, draft memakai varian dan rata-rata toko acuan atas bulan periode sumber gudang yang menghitung
// draft. Cakupan, kategori efektif, dan stok tetap milik toko itu. Golden `tests/golden/toko-acuan.json`.

type Golden = {
  kasusKebutuhan: {
    tanggalKirim: string;
    rataRataTokoAcuan: Record<KategoriDasar, number>;
    tanggalCakupan: { tanggal: string; kategoriEfektif: KategoriDasar }[];
    kebutuhan: number;
    jumlahKirim: { persenBuffer: number; stokAkhir: number; stokTarget: number; jumlahKirim: number };
    perubahanKategori: {
      nama: string;
      tanggal: string;
      cakupanPerubahan: "TOKO BARU" | "SMB";
      kategoriBaru: KategoriDasar;
      kategoriEfektif30Oktober: KategoriDasar;
      kebutuhan: number;
      stokTarget: number;
      jumlahKirim: number;
    }[];
  };
  tokoAcuanTanpaVarian: { tokoAcuan: string; pesan: string };
};
const golden = JSON.parse(readFileSync(join(import.meta.dirname, "../../../tests/golden/toko-acuan.json"), "utf8")) as Golden;
const kasus = golden.kasusKebutuhan;
const KAMIS = parseTanggalBisnis(kasus.tanggalKirim);

let idAdmin: string;
let idOperator: string;
let cibubur: number;
let data: Awaited<ReturnType<typeof siapkanTokoAcuanUji>>;

beforeAll(async () => {
  idAdmin = (await buatPenggunaUji("admin")).id;
  idOperator = (await buatPenggunaUji("viewer")).id;
  cibubur = await idGudangUji("Gudang Cibubur");
  data = await siapkanTokoAcuanUji({ idGudang: cibubur, idAdmin });
}, 120_000);

afterAll(async () => {
  await bersihkanTokoAcuanUji({ idGudang: cibubur, idToko: [data.smb.id, data.tokoBaru.id, data.lmk.id] });
});

const hitung = async () =>
  expect(await hitungDraftRencana({ idGudang: cibubur, tanggalKirim: KAMIS, idPengguna: idOperator })).toMatchObject({
    keadaan: "berhasil",
  });
const tokoDi = async (idToko: number) => (await bacaDraftRencana(cibubur, KAMIS))?.toko.find((t) => t.id === idToko);

describe("TOKO BARU (tanpa data penjualan) meminjam varian dan rata-rata SMB, kirim Kamis 2026-10-29 (golden kasusKebutuhan)", () => {
  it("8 tanggal cakupan milik TOKO BARU dengan kategori efektif sesuai fixture; rata-rata SMB; kebutuhan 45", async () => {
    await hitung();
    const toko = await tokoDi(data.tokoBaru.id);
    expect(toko?.cakupan?.map(({ tanggal, kategoriEfektif }) => ({ tanggal, kategoriEfektif }))).toEqual(
      kasus.tanggalCakupan.map(({ tanggal, kategoriEfektif }) => ({ tanggal, kategoriEfektif })),
    );
    const gor = toko?.baris.find((b) => b.kodeProduk === data.kode.gor);
    expect(gor?.rincian?.rataRata).toEqual(kasus.rataRataTokoAcuan);
    expect(gor).toMatchObject({ klasifikasi: "otomatis", kebutuhan: kasus.kebutuhan });
  });

  it("draft mencatat toko acuan SMB untuk TOKO BARU, tanpa catatan data sendiri", async () => {
    const tokoAcuan = { id: data.smb.id, nama: data.smb.nama, catatanDataSendiri: false };
    expect((await tokoDi(data.tokoBaru.id))?.tokoAcuan).toEqual(tokoAcuan);
    const ringkasan = await bacaRingkasanDraft(cibubur, KAMIS, data.tokoBaru.id);
    expect(ringkasan?.toko.find((t) => t.id === data.tokoBaru.id)?.tokoAcuan).toEqual(tokoAcuan);
    expect(ringkasan?.tokoDibuka?.tokoAcuan).toEqual(tokoAcuan);
    // Toko tanpa toko acuan tidak berubah: tidak punya properti toko acuan.
    expect(await tokoDi(data.smb.id)).not.toHaveProperty("tokoAcuan");
  });

  it("varian TOKO BARU = varian SMB di impor aktif periode sumber, termasuk yang penjualannya nol", async () => {
    const toko = await tokoDi(data.tokoBaru.id);
    expect(toko?.baris.map((b) => b.kodeProduk)).toEqual([data.kode.gor, data.kode.nol].sort());
    expect(toko?.baris.find((b) => b.kodeProduk === data.kode.nol)).toMatchObject({ kebutuhan: 0 });
  });

  it("SMB (tanpa toko acuan) di draft yang sama tetap memakai data sendiri", async () => {
    const smb = await tokoDi(data.smb.id);
    expect(smb?.baris.map((b) => b.kodeProduk)).toEqual([data.kode.gor, data.kode.nol].sort());
    expect(smb?.baris.find((b) => b.kodeProduk === data.kode.gor)).toMatchObject({ kebutuhan: kasus.kebutuhan });
  });

  it(`stok akhir ${kasus.jumlahKirim.stokAkhir} (tujuh besar) → stok target ${kasus.jumlahKirim.stokTarget}, jumlah kirim ${kasus.jumlahKirim.jumlahKirim}`, async () => {
    const stok = [{ kodeProduk: data.kode.gor, stokAkhir: kasus.jumlahKirim.stokAkhir }];
    expect(await simpanStokToko({ idGudang: cibubur, tanggalKirim: KAMIS, tokoId: data.tokoBaru.id, stok })).toEqual({
      keadaan: "berhasil",
    });
    const gor = (await tokoDi(data.tokoBaru.id))?.baris.find((b) => b.kodeProduk === data.kode.gor);
    expect(gor).toMatchObject({
      persenBuffer: kasus.jumlahKirim.persenBuffer,
      stokAkhir: kasus.jumlahKirim.stokAkhir,
      jumlahKirim: kasus.jumlahKirim.jumlahKirim,
    });
    expect(gor?.rincianJumlahKirim).toMatchObject({ stokTarget: kasus.jumlahKirim.stokTarget });
  });

  describe("perubahan kategori 30-10-2026 menjadi Minggu (golden perubahanKategori)", () => {
    for (const perubahan of kasus.perubahanKategori) {
      it(`${perubahan.nama}: kebutuhan ${perubahan.kebutuhan}, jumlah kirim ${perubahan.jumlahKirim}`, async () => {
        const idToko = perubahan.cakupanPerubahan === "SMB" ? data.smb.id : data.tokoBaru.id;
        const tanggal = parseTanggalBisnis(perubahan.tanggal);
        const cakupan = { tanggal, idToko };
        expect(
          await buatPerubahanKategori({ ...cakupan, kategoriBaru: perubahan.kategoriBaru, alasan: "Uji T151", idPengguna: idAdmin }),
        ).toEqual({ keadaan: "berhasil" });
        try {
          await hitung();
          const toko = await tokoDi(data.tokoBaru.id);
          expect(toko?.cakupan?.find((c) => c.tanggal === perubahan.tanggal)?.kategoriEfektif).toBe(perubahan.kategoriEfektif30Oktober);
          const gor = toko?.baris.find((b) => b.kodeProduk === data.kode.gor);
          // Stok akhir yang sudah diisi tetap dipakai setelah dihitung ulang.
          expect(gor).toMatchObject({
            kebutuhan: perubahan.kebutuhan,
            stokAkhir: kasus.jumlahKirim.stokAkhir,
            jumlahKirim: perubahan.jumlahKirim,
          });
          expect(gor?.rincianJumlahKirim).toMatchObject({ stokTarget: perubahan.stokTarget });
        } finally {
          await batalkanPerubahanKategori({ ...cakupan, alasan: "Selesai uji T151", idPengguna: idAdmin });
        }
      });
    }
  });
});

describe("LMK (toko acuan SMB) yang sudah punya data penjualan sendiri di periode sumber", () => {
  it("memakai varian dan rata-rata SMB, dengan catatan data sendiri", async () => {
    await hitung();
    const lmk = await tokoDi(data.lmk.id);
    expect(lmk?.tokoAcuan).toEqual({ id: data.smb.id, nama: data.smb.nama, catatanDataSendiri: true });
    expect(lmk?.baris.map((b) => b.kodeProduk)).toEqual([data.kode.gor, data.kode.nol].sort());
    expect(lmk?.baris.find((b) => b.kodeProduk === data.kode.gor)?.rincian?.rataRata).toEqual(kasus.rataRataTokoAcuan);
    expect(lmk?.baris.find((b) => b.kodeProduk === data.kode.gor)).toMatchObject({ kebutuhan: kasus.kebutuhan });
  });

  it("catatan data sendiri tidak menahan finalisasi", async () => {
    const stok = [
      { kodeProduk: data.kode.gor, stokAkhir: 20 },
      { kodeProduk: data.kode.nol, stokAkhir: 0 },
    ];
    expect(await simpanStokToko({ idGudang: cibubur, tanggalKirim: KAMIS, tokoId: data.lmk.id, stok })).toEqual({ keadaan: "berhasil" });
    const versiDilihat = (await tokoDi(data.lmk.id))?.versi ?? "";
    expect(
      await finalisasiRencanaToko({ idGudang: cibubur, tanggalKirim: KAMIS, tokoId: data.lmk.id, idPengguna: idOperator, versiDilihat }),
    ).toMatchObject({ keadaan: "berhasil" });
  });
});

describe("toko acuan tanpa varian di periode sumber (golden tokoAcuanTanpaVarian)", () => {
  it("teks masalah persis fixture; toko tanpa toko acuan tetap memakai teks lama", () => {
    const { tokoAcuan, pesan } = golden.tokoAcuanTanpaVarian;
    expect(masalahTanpaVarian({ nama: tokoAcuan })).toBe(pesan);
    expect(masalahTanpaVarian(undefined)).toBe(MASALAH_TANPA_VARIAN);
  });

  it("periode sumber tanpa data SMB: TOKO BARU tanpa varian dan finalisasinya ditolak", async () => {
    const hasil = await tetapkanPeriodeSumber({ idGudang: cibubur, bulan: [data.bulanTanpaSmb], idPengguna: idAdmin });
    expect(hasil).toMatchObject({ keadaan: "berhasil" });
    await hitung();
    const tokoBaru = await tokoDi(data.tokoBaru.id);
    expect(tokoBaru).toMatchObject({ baris: [], tokoAcuan: { id: data.smb.id, nama: data.smb.nama, catatanDataSendiri: false } });
    expect(
      await finalisasiRencanaToko({
        idGudang: cibubur,
        tanggalKirim: KAMIS,
        tokoId: data.tokoBaru.id,
        idPengguna: idOperator,
        versiDilihat: tokoBaru?.versi ?? "",
      }),
    ).toEqual({ keadaan: "gagal", pesan: PESAN_TANPA_VARIAN });
    // LMK punya data sendiri di bulan itu, tetapi tetap meminjam varian SMB: tanpa varian, dengan catatan.
    expect(await tokoDi(data.lmk.id)).toMatchObject({ baris: [], tokoAcuan: { catatanDataSendiri: true } });
  });
});
