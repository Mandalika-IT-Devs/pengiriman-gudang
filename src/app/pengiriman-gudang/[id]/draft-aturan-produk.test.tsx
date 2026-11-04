import { and, eq, inArray } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTanggalBisnis } from "@/domain/kalender";
import { buatPenggunaUji, kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { barisDraftRencana, draftRencana, hubunganTokoGudang, jadwalToko, produk, tokoDraftRencana } from "@/server/db/schema";
import { bacaDraftRencana } from "@/server/gudang/draft-rencana";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { tetapkanPeriodeSumber } from "@/server/gudang/periode-sumber";
import { PESAN_PERLU_DIHITUNG_ULANG } from "@/server/gudang/rencana-final";
import { buatGudangUji, buatTokoUji, hapusGudangUji } from "@/server/gudang/uji-bantu";
import { kodeProdukUji, tahunUjiBebas } from "@/server/impor/uji-bantu";
import { hitungUlangCacheLaporan } from "@/server/laporan/cache";
import { aktifkanImporJuniUji } from "@/server/laporan/uji-bantu";
import { buatKeluargaUji, publikasikanRankingUji } from "@/server/ranking/uji-bantu";

const kepala = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", async (asli) => ({
  ...(await asli<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import { hitungDraft } from "./aksi-draft";
import { finalisasiRencana } from "./aksi-final";
import { simpanStok } from "./aksi-stok";
import HalamanPengirimanGudang from "./page";

// T146 — PRD A6 ▶ Keputusan 2026-11-04 (butir "Draft yang belum final"), A7 ▶ Keputusan 2026-10-11; ADR-0012; UAT U9.1.
// Draft yang dihitung sebelum produk display menjadi produk manual menyimpan DP120E-24H (DISPLAY PRIA) sebagai otomatis.
// Draft itu ditandai "Perlu dihitung ulang" dengan dasar "Aturan produk manual", hanya toko yang memuat baris itu yang
// tertahan finalisasinya, dan angkanya baru berubah setelah Hitung ulang, dengan stok yang sudah diisi tetap ada.

const TANGGAL_KIRIM = "2026-11-09";
const SEMUA_HARI_JUNI = Array.from({ length: 30 }, (_, i) => i + 1);
const DISPLAY = "DP120E-24H";
/** Produk display toko B yang klasifikasi tersimpannya sudah sama dengan aturan saat ini. */
const DISPLAY_TOKO_B = "DD-GS15-B";
const kode = { otomatisA: kodeProdukUji("GOR"), otomatisB: kodeProdukUji("GOR") };
const produkOtomatis = (kodeProduk: string) => ({
  kode: kodeProduk,
  nama: "15ML GLITTER - GORGEOUS",
  ukuran: "15ML",
  kategori: "15ML GLITTER/LEATHER",
  kuantitas: SEMUA_HARI_JUNI.map(() => 2),
});
const produkDisplay = (kodeProduk: string, nama: string, kategori: string) => ({
  kode: kodeProduk,
  nama,
  ukuran: "120ML",
  kategori,
  kuantitas: SEMUA_HARI_JUNI.map(() => 1),
});

let idGudang: number;
/** Toko yang memuat DP120E-24H. */
let tokoA: { id: number; nama: string };
/** Toko yang tidak memuat DP120E-24H. */
let tokoB: { id: number; nama: string };

beforeAll(async () => {
  const idAdmin = (await buatPenggunaUji("admin")).id;
  idGudang = (await buatGudangUji()).id;
  [tokoA, tokoB] = [await buatTokoUji(), await buatTokoUji()];
  await db.insert(hubunganTokoGudang).values([tokoA, tokoB].map((t) => ({ tokoId: t.id, gudangId: idGudang })));
  await db.insert(jadwalToko).values(
    [tokoA, tokoB].map((t) => ({
      tokoId: t.id,
      pola: "mingguan" as const,
      hariKirim: [{ hari: "Senin" as const, persiapanHari: 1 as const }],
      dibuatOleh: idAdmin,
    })),
  );

  const [tahunA, tahunB] = [await tahunUjiBebas(), await tahunUjiBebas()];
  await aktifkanImporJuniUji({
    idAdmin,
    tahun: tahunA,
    namaToko: tokoA.nama,
    hari: SEMUA_HARI_JUNI,
    produk: [produkOtomatis(kode.otomatisA), produkDisplay(DISPLAY, "DISPLAY 24 HOURS", "DISPLAY PRIA")],
  });
  await aktifkanImporJuniUji({
    idAdmin,
    tahun: tahunB,
    namaToko: tokoB.nama,
    hari: SEMUA_HARI_JUNI,
    produk: [produkOtomatis(kode.otomatisB), produkDisplay(DISPLAY_TOKO_B, "DISPLAY DUMMY GIFT SET 15ML", "DISPLAY WANITA")],
  });
  await hitungUlangCacheLaporan();
  const periode = await tetapkanPeriodeSumber({ idGudang, bulan: [`${tahunA}-06`, `${tahunB}-06`].sort(), idPengguna: idAdmin });
  if (periode.keadaan !== "berhasil") throw new Error(periode.pesan);

  const keluarga = await buatKeluargaUji();
  await publikasikanRankingUji({ keluarga: [keluarga.id], idPengguna: idAdmin });
  await db
    .update(produk)
    .set({ statusKeluargaAroma: "terpetakan", keluargaAromaId: keluarga.id })
    .where(inArray(produk.kode, [kode.otomatisA, kode.otomatisB, DISPLAY]));
}, 120_000);

afterAll(async () => {
  // Draft merujuk periode sumber, jadi dihapus sebelum gudang uji.
  await db.delete(draftRencana).where(eq(draftRencana.gudangId, idGudang));
  await hapusGudangUji(idGudang);
});

beforeEach(async () => {
  const operator = await kepalaPenggunaUji("viewer");
  await tugaskanOperator({ idPengguna: operator.id, idGudang, hakTindakan: ["hitung-kebutuhan", "input-stok", "finalisasi"] });
  kepala.cookie = operator.cookie;
});

const draft = () => bacaDraftRencana(idGudang, parseTanggalBisnis(TANGGAL_KIRIM));
const tokoDraft = async (tokoId: number) => (await draft())?.toko.find((t) => t.id === tokoId);
const barisDraft = async (tokoId: number, kodeProduk: string) => (await tokoDraft(tokoId))?.baris.find((b) => b.kodeProduk === kodeProduk);
const finalisasi = async (tokoId: number) =>
  finalisasiRencana({ idGudang, tanggalKirim: TANGGAL_KIRIM, tokoId, versi: (await tokoDraft(tokoId))?.versi ?? "" });
const bukaToko = async (tokoId: number) =>
  renderToStaticMarkup(
    await HalamanPengirimanGudang({
      params: Promise.resolve({ id: String(idGudang) }),
      searchParams: Promise.resolve({ tanggal: TANGGAL_KIRIM, toko: String(tokoId) }),
    }),
  );

/**
 * Baris `kodeProduk` toko `tokoId` dibuat seperti hasil hitung sebelum PRD A6 ▶ Keputusan 2026-11-04 (ADR-0007): produk
 * display dihitung otomatis, dengan buffer keluarga tujuh besar. Master produknya tetap manual menurut aturan saat ini.
 */
async function jadikanBarisDraftLama(tokoId: number, kodeProduk: string) {
  const idTokoDraft = db
    .select({ id: tokoDraftRencana.id })
    .from(tokoDraftRencana)
    .innerJoin(draftRencana, eq(draftRencana.id, tokoDraftRencana.draftId))
    .where(and(eq(draftRencana.gudangId, idGudang), eq(draftRencana.tanggalKirim, TANGGAL_KIRIM), eq(tokoDraftRencana.tokoId, tokoId)));
  await db
    .update(barisDraftRencana)
    .set({ klasifikasi: "otomatis", persenBuffer: 20, masalah: ["stok-belum-diisi"], jumlahKirim: null })
    .where(and(inArray(barisDraftRencana.tokoDraftId, idTokoDraft), eq(barisDraftRencana.kodeProduk, kodeProduk)));
}

describe('draft lama ditandai "Perlu dihitung ulang" karena aturan produk manual (PRD A6 ▶ Keputusan 2026-11-04)', () => {
  it('draft yang klasifikasi tersimpannya sama dengan aturan saat ini tidak mendapat dasar "Aturan produk manual"', async () => {
    await expect(hitungDraft({ idGudang, tanggalKirim: TANGGAL_KIRIM })).resolves.toEqual({ keadaan: "berhasil" });
    expect(await barisDraft(tokoA.id, DISPLAY)).toMatchObject({ klasifikasi: "manual" });
    expect(await barisDraft(tokoB.id, DISPLAY_TOKO_B)).toMatchObject({ klasifikasi: "manual" });
    expect((await draft())?.perluDihitungUlang).toEqual([]);
  });

  it('baris DP120E-24H tersimpan otomatis → draft ditandai "Aturan produk manual"; hanya toko yang memuatnya tertahan', async () => {
    await jadikanBarisDraftLama(tokoA.id, DISPLAY);
    await expect(
      simpanStok({
        idGudang,
        tanggalKirim: TANGGAL_KIRIM,
        tokoId: tokoA.id,
        stok: [
          { kodeProduk: kode.otomatisA, stokAkhir: 3 },
          { kodeProduk: DISPLAY, stokAkhir: 5 },
        ],
      }),
    ).resolves.toEqual({ keadaan: "berhasil" });
    await expect(
      simpanStok({ idGudang, tanggalKirim: TANGGAL_KIRIM, tokoId: tokoB.id, stok: [{ kodeProduk: kode.otomatisB, stokAkhir: 4 }] }),
    ).resolves.toEqual({ keadaan: "berhasil" });

    expect((await draft())?.perluDihitungUlang).toEqual(["aturan-produk"]);
    expect((await tokoDraft(tokoA.id))?.perluDihitungUlang).toEqual(["aturan-produk"]);
    expect((await tokoDraft(tokoB.id))?.perluDihitungUlang).toEqual([]);
    // Angka draft belum berubah sebelum Hitung ulang.
    expect(await barisDraft(tokoA.id, DISPLAY)).toMatchObject({ klasifikasi: "otomatis", persenBuffer: 20, stokAkhir: 5 });

    // PRD A7 ▶ Keputusan 2026-10-11: toko lain di draft yang sama tetap bisa difinalisasi.
    expect(await finalisasi(tokoA.id)).toEqual({ keadaan: "gagal", pesan: PESAN_PERLU_DIHITUNG_ULANG });
    expect(await finalisasi(tokoB.id)).toMatchObject({ keadaan: "berhasil" });
  });

  it('penanda di halaman Pengiriman Gudang menyebut "Aturan produk manual" di daftar yang berubah', async () => {
    const html = await bukaToko(tokoA.id);
    const penanda = /<div[^>]*data-perlu-dihitung-ulang.*?<\/ul>/.exec(html)?.[0] ?? "";
    expect(penanda).toMatch(/Yang berubah:.*?<li[^>]*data-alasan-hitung-ulang="aturan-produk"[^>]*>Aturan produk manual<\/li>/);
    expect(html).toMatch(/data-finalisasi-tertahan="\d+"[^>]*>.*?dasar perhitungan toko ini berubah \(Aturan produk manual\)/);
  });

  it('setelah Hitung ulang: dasar itu hilang, DP120E-24H "Manual", dan stok yang sudah diisi tetap ada', async () => {
    await expect(hitungDraft({ idGudang, tanggalKirim: TANGGAL_KIRIM })).resolves.toEqual({ keadaan: "berhasil" });

    expect((await draft())?.perluDihitungUlang).toEqual([]);
    expect(await barisDraft(tokoA.id, DISPLAY)).toMatchObject({
      klasifikasi: "manual",
      stokAkhir: 5,
      persenBuffer: null,
      masalah: [],
      jumlahKirim: null,
    });
    expect(await barisDraft(tokoA.id, kode.otomatisA)).toMatchObject({ klasifikasi: "otomatis", stokAkhir: 3 });
    const tr = new RegExp(`<tr[^>]*data-kode-produk="${DISPLAY}".*?</tr>`).exec(await bukaToko(tokoA.id))?.[0] ?? "";
    expect(tr).toMatch(/data-status="manual".*?Manual/);

    expect(await finalisasi(tokoA.id)).toMatchObject({ keadaan: "berhasil" });
  });
});
