import { readFileSync } from "node:fs";
import { join } from "node:path";

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseTanggalBisnis, type KategoriDasar } from "@/domain/kalender";
import { buatPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { draftRencana, tokoDraftRencana } from "@/server/db/schema";
import { batalkanPerubahanKategori, buatPerubahanKategori } from "@/server/kalender/perubahan-kategori";

import { bacaDraftRencana, bacaRingkasanDraft, hitungDraftRencana } from "./draft-rencana";
import { MASALAH_TANPA_VARIAN, masalahTanpaVarian } from "./masalah-draft";
import { tetapkanPeriodeSumber } from "./periode-sumber";
import { finalisasiRencanaToko, PESAN_TANPA_VARIAN } from "./rencana-final";
import { simpanStokToko } from "./stok-draft";
import { bersihkanTokoAcuanUji, siapkanTokoAcuanUji } from "./uji-bantu-toko-acuan";
import { buatGudangUji, hapusGudangUji } from "./uji-bantu";

// T151 — PRD A5 ▶ Keputusan 2026-11-04 (toko acuan: Perhitungan) dan A6 ▶ Keputusan 2026-11-04: untuk toko yang jadwal
// tetapnya memakai toko acuan, draft memakai varian dan rata-rata toko acuan atas bulan periode sumber gudang yang menghitung
// draft. Cakupan, kategori efektif, dan stok tetap milik toko itu. Golden `tests/golden/toko-acuan.json`. Berkas ini memakai
// gudang uji sendiri, supaya draft hanya memuat SMB, TOKO BARU, dan LMK, apa pun toko yang dihubungkan berkas test lain ke
// gudang hasil seed.

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
let idGudang: number;
let data: Awaited<ReturnType<typeof siapkanTokoAcuanUji>>;

beforeAll(async () => {
  idAdmin = (await buatPenggunaUji("admin")).id;
  idOperator = (await buatPenggunaUji("viewer")).id;
  idGudang = (await buatGudangUji()).id;
  data = await siapkanTokoAcuanUji({ idGudang, idAdmin });
}, 120_000);

afterAll(async () => {
  await bersihkanTokoAcuanUji({ idGudang, idToko: [data.smb.id, data.tokoBaru.id, data.lmk.id] });
  await hapusGudangUji(idGudang);
});

const hitung = async () =>
  expect(await hitungDraftRencana({ idGudang, tanggalKirim: KAMIS, idPengguna: idOperator })).toMatchObject({
    keadaan: "berhasil",
  });
const tokoDi = async (idToko: number) => (await bacaDraftRencana(idGudang, KAMIS))?.toko.find((t) => t.id === idToko);

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
    const ringkasan = await bacaRingkasanDraft(idGudang, KAMIS, data.tokoBaru.id);
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
    expect(await simpanStokToko({ idGudang, tanggalKirim: KAMIS, tokoId: data.tokoBaru.id, stok })).toEqual({
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
    expect(await simpanStokToko({ idGudang, tanggalKirim: KAMIS, tokoId: data.lmk.id, stok })).toEqual({ keadaan: "berhasil" });
    const versiDilihat = (await tokoDi(data.lmk.id))?.versi ?? "";
    expect(
      await finalisasiRencanaToko({ idGudang, tanggalKirim: KAMIS, tokoId: data.lmk.id, idPengguna: idOperator, versiDilihat }),
    ).toMatchObject({ keadaan: "berhasil" });
  });
});

// PRD A5 ▶ Keputusan 2026-11-04 (Perubahan dan peralihan): toko acuan bagian dari jadwal tetap, jadi toko acuan tersimpan
// di draft yang berbeda dari toko acuan jadwal tetap aktif menandai toko itu perlu dihitung ulang dengan dasar "Jadwal
// toko". Ini menutup draft yang dihitung sebelum T151 (toko acuan tersimpan kosong) untuk toko yang sudah memakai toko
// acuan.
describe('toko acuan tersimpan berbeda dari jadwal tetap aktif → "Jadwal toko"', () => {
  /** Mengosongkan toko acuan tersimpan TOKO BARU, seperti draft yang dihitung sebelum T151. */
  const jadikanDraftSebelumT151 = async () => {
    const [draft] = await db
      .select({ id: draftRencana.id })
      .from(draftRencana)
      .where(and(eq(draftRencana.gudangId, idGudang), eq(draftRencana.tanggalKirim, KAMIS)));
    await db
      .update(tokoDraftRencana)
      .set({ tokoAcuanId: null })
      .where(and(eq(tokoDraftRencana.draftId, draft.id), eq(tokoDraftRencana.tokoId, data.tokoBaru.id)));
  };
  const tandaPerToko = async () =>
    Object.fromEntries((await bacaDraftRencana(idGudang, KAMIS))?.toko.map((t) => [t.id, t.perluDihitungUlang]) ?? []);

  it("toko acuan tersimpan sama dengan jadwal tetap aktif → tidak ditandai", async () => {
    await hitung();
    expect((await bacaDraftRencana(idGudang, KAMIS))?.perluDihitungUlang).toEqual([]);
    expect(await tandaPerToko()).toEqual({ [data.smb.id]: [], [data.tokoBaru.id]: [], [data.lmk.id]: [] });
  });

  it("toko acuan tersimpan kosong, jadwal tetap aktif memakai SMB → hanya TOKO BARU ditandai jadwal; hilang setelah dihitung ulang", async () => {
    await jadikanDraftSebelumT151();
    expect((await bacaDraftRencana(idGudang, KAMIS))?.perluDihitungUlang).toEqual(["jadwal"]);
    expect(await tandaPerToko()).toEqual({ [data.smb.id]: [], [data.tokoBaru.id]: ["jadwal"], [data.lmk.id]: [] });

    await hitung();
    expect((await bacaDraftRencana(idGudang, KAMIS))?.perluDihitungUlang).toEqual([]);
    expect(await tandaPerToko()).toEqual({ [data.smb.id]: [], [data.tokoBaru.id]: [], [data.lmk.id]: [] });
    expect((await tokoDi(data.tokoBaru.id))?.tokoAcuan).toMatchObject({ id: data.smb.id });
  });
});

describe("toko acuan tanpa varian di periode sumber (golden tokoAcuanTanpaVarian)", () => {
  it("teks masalah persis fixture; toko tanpa toko acuan tetap memakai teks lama", () => {
    const { tokoAcuan, pesan } = golden.tokoAcuanTanpaVarian;
    expect(masalahTanpaVarian({ nama: tokoAcuan })).toBe(pesan);
    expect(masalahTanpaVarian(undefined)).toBe(MASALAH_TANPA_VARIAN);
  });

  it("periode sumber tanpa data SMB: TOKO BARU tanpa varian dan finalisasinya ditolak", async () => {
    const hasil = await tetapkanPeriodeSumber({ idGudang, bulan: [data.bulanTanpaSmb], idPengguna: idAdmin });
    expect(hasil).toMatchObject({ keadaan: "berhasil" });
    await hitung();
    const tokoBaru = await tokoDi(data.tokoBaru.id);
    expect(tokoBaru).toMatchObject({ baris: [], tokoAcuan: { id: data.smb.id, nama: data.smb.nama, catatanDataSendiri: false } });
    expect(
      await finalisasiRencanaToko({
        idGudang,
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
