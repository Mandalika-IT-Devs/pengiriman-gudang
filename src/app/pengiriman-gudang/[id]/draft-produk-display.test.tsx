import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTanggalBisnis } from "@/domain/kalender";
import { buatPenggunaUji, kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { draftRencana, hubunganTokoGudang, jadwalToko, produk } from "@/server/db/schema";
import { bacaDraftRencana } from "@/server/gudang/draft-rencana";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { tetapkanPeriodeSumber } from "@/server/gudang/periode-sumber";
import { bacaRencanaFinal } from "@/server/gudang/rencana-final";
import { buatGudangUji, buatTokoUji, hapusGudangUji } from "@/server/gudang/uji-bantu";
import { kodeProdukUji, tahunUjiBebas } from "@/server/impor/uji-bantu";
import { hitungUlangCacheLaporan } from "@/server/laporan/cache";
import { aktifkanImporJuniUji } from "@/server/laporan/uji-bantu";
import { buatKeluargaUji, publikasikanRankingUji } from "@/server/ranking/uji-bantu";

const kepala = vi.hoisted(() => ({ cookie: "", dimuatUlang: [] as string[] }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    kepala.dimuatUlang.push(path);
  },
}));
vi.mock("next/navigation", async (asli) => ({
  ...(await asli<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import { hitungDraft } from "./aksi-draft";
import { finalisasiRencana } from "./aksi-final";
import { simpanStok } from "./aksi-stok";
import HalamanPengirimanGudang from "./page";

// T145 — PRD A6 ▶ Keputusan 2026-11-04 (ADR-0012), UAT U9.2: draft yang baru dihitung menampilkan produk display (display
// biasa DP120E-24H, display dummy DD-GS15-B, display rework DP120E-ONL-R) sebagai produk manual: status "Manual", tanpa
// jumlah kirim dan tanpa buffer otomatis, tidak menahan finalisasi walaupun stoknya kosong atau negatif, dan tidak diisi
// tombol "Isi 0 untuk … stok yang kosong". Aturan produk manual lainnya mengikuti PRD A6 ▶ Keputusan T05.

const TANGGAL_KIRIM = "2026-11-09";
const SEMUA_HARI_JUNI = Array.from({ length: 30 }, (_, i) => i + 1);
const PRODUK_DISPLAY = [
  { kode: "DP120E-24H", nama: "DISPLAY 24 HOURS", kategori: "DISPLAY PRIA" },
  { kode: "DD-GS15-B", nama: "DISPLAY DUMMY GIFT SET 15ML", kategori: "DISPLAY WANITA" },
  { kode: "DP120E-ONL-R", nama: "DISPLAY ONLY YOU REWORK", kategori: "DISPLAY PRIA" },
];
const KODE_DISPLAY = PRODUK_DISPLAY.map((p) => p.kode);
const kodeOtomatis = kodeProdukUji("GOR");

let idGudang: number;
let toko: { id: number; nama: string };

beforeAll(async () => {
  const idAdmin = (await buatPenggunaUji("admin")).id;
  idGudang = (await buatGudangUji()).id;
  toko = await buatTokoUji();
  await db.insert(hubunganTokoGudang).values({ tokoId: toko.id, gudangId: idGudang });
  await db.insert(jadwalToko).values({
    tokoId: toko.id,
    pola: "mingguan",
    hariKirim: [{ hari: "Senin", persiapanHari: 1 }],
    dibuatOleh: idAdmin,
  });

  const tahun = await tahunUjiBebas();
  await aktifkanImporJuniUji({
    idAdmin,
    tahun,
    namaToko: toko.nama,
    hari: SEMUA_HARI_JUNI,
    produk: [
      {
        kode: kodeOtomatis,
        nama: "15ML GLITTER - GORGEOUS",
        ukuran: "15ML",
        kategori: "15ML GLITTER/LEATHER",
        kuantitas: SEMUA_HARI_JUNI.map(() => 2),
      },
      ...PRODUK_DISPLAY.map((p) => ({ ...p, ukuran: "120ML", kuantitas: SEMUA_HARI_JUNI.map(() => 1) })),
    ],
  });
  await hitungUlangCacheLaporan();
  const periode = await tetapkanPeriodeSumber({ idGudang, bulan: [`${tahun}-06`], idPengguna: idAdmin });
  if (periode.keadaan !== "berhasil") throw new Error(periode.pesan);

  const keluarga = await buatKeluargaUji();
  await publikasikanRankingUji({ keluarga: [keluarga.id], idPengguna: idAdmin });
  await db.update(produk).set({ statusKeluargaAroma: "terpetakan", keluargaAromaId: keluarga.id }).where(eq(produk.kode, kodeOtomatis));
}, 120_000);

afterAll(async () => {
  // Draft merujuk periode sumber, jadi dihapus sebelum gudang uji.
  await db.delete(draftRencana).where(eq(draftRencana.gudangId, idGudang));
  await hapusGudangUji(idGudang);
});

beforeEach(async () => {
  kepala.dimuatUlang = [];
  const operator = await kepalaPenggunaUji("viewer");
  await tugaskanOperator({ idPengguna: operator.id, idGudang, hakTindakan: ["hitung-kebutuhan", "input-stok", "finalisasi"] });
  kepala.cookie = operator.cookie;
});

const bukaToko = async () =>
  renderToStaticMarkup(
    await HalamanPengirimanGudang({
      params: Promise.resolve({ id: String(idGudang) }),
      searchParams: Promise.resolve({ tanggal: TANGGAL_KIRIM, toko: String(toko.id) }),
    }),
  );

const barisHtml = (html: string, kode: string) => new RegExp(`<tr[^>]*data-kode-produk="${kode}".*?</tr>`).exec(html)?.[0] ?? "";

const tokoDraft = async () => (await bacaDraftRencana(idGudang, parseTanggalBisnis(TANGGAL_KIRIM)))?.toko.find((t) => t.id === toko.id);

describe("produk display di draft yang baru dihitung (PRD A6 ▶ Keputusan 2026-11-04)", () => {
  it('berstatus "Manual" tanpa jumlah kirim dan buffer; "Isi 0 untuk … stok yang kosong" hanya menghitung produk otomatis', async () => {
    await expect(hitungDraft({ idGudang, tanggalKirim: TANGGAL_KIRIM })).resolves.toEqual({ keadaan: "berhasil" });

    const baris = (await tokoDraft())?.baris ?? [];
    expect(baris.map((b) => b.kodeProduk).sort()).toEqual([kodeOtomatis, ...KODE_DISPLAY].sort());
    for (const kode of KODE_DISPLAY) {
      expect(
        baris.find((b) => b.kodeProduk === kode),
        kode,
      ).toMatchObject({ klasifikasi: "manual", persenBuffer: null, masalah: [], jumlahKirim: null });
    }
    expect(baris.find((b) => b.kodeProduk === kodeOtomatis)).toMatchObject({ klasifikasi: "otomatis", masalah: ["stok-belum-diisi"] });

    const html = await bukaToko();
    for (const kode of KODE_DISPLAY) {
      const tr = barisHtml(html, kode);
      expect(tr, kode).toMatch(/data-status="manual".*?Manual/);
      expect(tr, kode).toMatch(/data-jumlah-kirim="kosong"[^>]*>—</);
      expect(tr, kode).not.toContain("data-masalah=");
    }
    // Hanya produk otomatis yang stoknya kosong; ketiga produk display tidak dihitung.
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Isi 0 untuk 1 stok yang kosong<\/button>/);
  });

  it("stok display kosong atau negatif tidak menahan finalisasi; stoknya tersimpan tanpa buffer dan jumlah kirim", async () => {
    const stok = [
      { kodeProduk: kodeOtomatis, stokAkhir: 3 },
      { kodeProduk: "DP120E-24H", stokAkhir: -1 },
      { kodeProduk: "DD-GS15-B", stokAkhir: null },
      { kodeProduk: "DP120E-ONL-R", stokAkhir: 4 },
    ];
    await expect(simpanStok({ idGudang, tanggalKirim: TANGGAL_KIRIM, tokoId: toko.id, stok })).resolves.toEqual({ keadaan: "berhasil" });
    const draft = await tokoDraft();
    expect(draft?.baris.find((b) => b.kodeProduk === "DP120E-24H")).toMatchObject({ stokAkhir: -1, masalah: [], jumlahKirim: null });

    const hasil = await finalisasiRencana({ idGudang, tanggalKirim: TANGGAL_KIRIM, tokoId: toko.id, versi: draft?.versi ?? "" });
    expect(hasil).toMatchObject({ keadaan: "berhasil" });
    if (hasil.keadaan === "gagal") return;

    const rencana = await bacaRencanaFinal(idGudang, hasil.idRencana);
    const barisFinal = (kode: string) => rencana?.baris.find((b) => b.kodeProduk === kode);
    for (const { kodeProduk, stokAkhir } of stok.filter((s) => s.kodeProduk !== kodeOtomatis)) {
      expect(barisFinal(kodeProduk), kodeProduk).toMatchObject({ status: "manual", stokAkhir, persenBuffer: null, jumlahKirim: null });
    }
    expect(barisFinal(kodeOtomatis)).toMatchObject({ status: "siap" });
  });
});
