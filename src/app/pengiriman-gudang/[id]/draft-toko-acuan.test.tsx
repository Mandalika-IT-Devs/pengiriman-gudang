import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { parseTanggalBisnis, type KategoriDasar } from "@/domain/kalender";
import { buatPenggunaUji, kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { hitungDraftRencana } from "@/server/gudang/draft-rencana";
import { daftarHakTindakan } from "@/server/gudang/hak-tindakan";
import { tetapkanPeriodeSumber } from "@/server/gudang/periode-sumber";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { simpanStokToko } from "@/server/gudang/stok-draft";
import { bersihkanTokoAcuanUji, siapkanTokoAcuanUji } from "@/server/gudang/uji-bantu-toko-acuan";
import { idGudangUji } from "@/server/gudang/uji-bantu";
import { nilaiRincian } from "@/server/laporan/rincian";

const kepala = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));
vi.mock("next/navigation", async (asli) => ({
  ...(await asli<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import HalamanPengirimanGudang from "./page";

// T151 — PRD A5 ▶ Keputusan 2026-11-04 (toko acuan: Tampilan, Draft): kepala toko menampilkan "Rata-rata dipinjam dari
// toko acuan <B>" dengan bantuan istilah "Toko acuan", dan catatan bila toko itu sudah punya data penjualan sendiri. Rincian
// baris memberi keterangan yang sama pada rata-rata per kategori, dan tautannya membuka Ringkasan toko acuan. Toko acuan
// tanpa varian tampil sebagai masalah yang menahan finalisasi. Golden `tests/golden/toko-acuan.json`.

const golden = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../tests/golden/toko-acuan.json"), "utf8")) as {
  sumberVarianDanRataRata: { tokoAcuan: string | null; catatanDataSendiri: boolean; teksCatatan?: string }[];
  kasusKebutuhan: { tanggalKirim: string };
  tokoAcuanTanpaVarian: { tokoAcuan: string; pesan: string };
};
const TEKS_CATATAN = golden.sumberVarianDanRataRata.find((k) => k.catatanDataSendiri)?.teksCatatan ?? "";
const tanggalKirim = parseTanggalBisnis(golden.kasusKebutuhan.tanggalKirim);
const KATEGORI: KategoriDasar[] = ["Senin–Kamis", "Jumat", "Sabtu", "Minggu"];

let bandung: number;
let idAdmin: string;
let idOperator: string;
let data: Awaited<ReturnType<typeof siapkanTokoAcuanUji>>;

beforeAll(async () => {
  idAdmin = (await buatPenggunaUji("admin")).id;
  bandung = await idGudangUji("Gudang Bandung");
  data = await siapkanTokoAcuanUji({ idGudang: bandung, idAdmin });
  const operator = await kepalaPenggunaUji("viewer");
  await tugaskanOperator({ idPengguna: operator.id, idGudang: bandung, hakTindakan: [...daftarHakTindakan] });
  kepala.cookie = operator.cookie;
  idOperator = operator.id;
  const hasil = await hitungDraftRencana({ idGudang: bandung, tanggalKirim, idPengguna: idOperator });
  if (hasil.keadaan !== "berhasil") throw new Error(hasil.pesan);
}, 120_000);

afterAll(async () => {
  await bersihkanTokoAcuanUji({ idGudang: bandung, idToko: [data.smb.id, data.tokoBaru.id, data.lmk.id] });
});

const bukaToko = async (idToko: number, tambahan: Record<string, string> = {}) =>
  renderToStaticMarkup(
    await HalamanPengirimanGudang({
      params: Promise.resolve({ id: String(bandung) }),
      searchParams: Promise.resolve({ tanggal: golden.kasusKebutuhan.tanggalKirim, toko: String(idToko), ...tambahan }),
    }),
  );

/** Teks yang terbaca: tanpa tombol bantuan istilah (berlabel aria-label saja) dan tanpa tag. */
const teksTerbaca = (html: string) =>
  html
    .replace(/<button[^>]*data-bantuan-istilah[^>]*>.*?<\/button>/g, "")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&quot;", '"');

/** Isi kepala toko yang menempel (`data-kepala-toko`), sampai teks cakupan sesudahnya. */
const kepalaToko = (html: string, idToko: number) =>
  new RegExp(`<div[^>]*data-kepala-toko="${idToko}".*?(?=<p[^>]*><span data-teks-cakupan)`).exec(html)?.[0] ?? "";

const teksTokoAcuan = () => `Rata-rata dipinjam dari toko acuan ${data.smb.nama}`;

describe("kepala toko draft yang memakai toko acuan", () => {
  it(`TOKO BARU: "Rata-rata dipinjam dari toko acuan SMB" dengan bantuan istilah Toko acuan, tanpa catatan data sendiri`, async () => {
    const isi = kepalaToko(await bukaToko(data.tokoBaru.id), data.tokoBaru.id);
    expect(teksTerbaca(isi)).toContain(teksTokoAcuan());
    expect(isi).toMatch(/<button[^>]*aria-label="Apa itu Toko acuan\?"[^>]*data-bantuan-istilah="tokoAcuan"/);
    expect(teksTerbaca(isi)).not.toContain(TEKS_CATATAN);
  });

  it("LMK (sudah punya data sendiri): label toko acuan dan catatan persis PRD; catatan tidak menahan finalisasi", async () => {
    const stok = [
      { kodeProduk: data.kode.gor, stokAkhir: 20 },
      { kodeProduk: data.kode.nol, stokAkhir: 0 },
    ];
    expect(await simpanStokToko({ idGudang: bandung, tanggalKirim, tokoId: data.lmk.id, stok })).toEqual({ keadaan: "berhasil" });
    const isi = kepalaToko(await bukaToko(data.lmk.id), data.lmk.id);
    expect(teksTerbaca(isi)).toContain(teksTokoAcuan());
    expect(isi).toMatch(/<p[^>]*data-catatan-data-sendiri[^>]*>.*?lucide-info.*?<\/p>/);
    expect(teksTerbaca(/<p[^>]*data-catatan-data-sendiri[^>]*>.*?<\/p>/.exec(isi)?.[0] ?? "")).toBe(TEKS_CATATAN);
    expect(isi).toContain(`data-finalisasi-toko="${data.lmk.id}"`);
    expect(isi).not.toContain("data-finalisasi-tertahan");
  });

  it("toko tanpa toko acuan (SMB) tidak berubah: tanpa label dan tanpa catatan", async () => {
    const isi = kepalaToko(await bukaToko(data.smb.id), data.smb.id);
    expect(isi).not.toContain("toko acuan");
    expect(isi).not.toContain("data-catatan-data-sendiri");
  });
});

describe("rincian baris toko yang memakai toko acuan", () => {
  it("rata-rata per kategori diberi keterangan toko acuan, dan tautannya membuka Ringkasan dengan filter toko SMB", async () => {
    const html = await bukaToko(data.tokoBaru.id, { rincian: `${data.tokoBaru.id}|${data.kode.gor}` });
    const rataRata = /<div[^>]*data-tahap="rata-rata".*?<\/ul>/.exec(html)?.[0] ?? "";
    expect(teksTerbaca(rataRata)).toContain(teksTokoAcuan());
    expect(rataRata).toMatch(/data-bantuan-istilah="tokoAcuan"/);
    for (const kategori of KATEGORI) {
      const tautan = new RegExp(`<a[^>]*data-tautan-ringkasan="${kategori}"[^>]*>`).exec(rataRata)?.[0] ?? "";
      const href = /href="([^"]*)"/.exec(tautan)?.[1] ?? "";
      const parameter = new URLSearchParams(href.replaceAll("&amp;", "&").split("?")[1]);
      expect(parameter.get("toko"), kategori).toBe(String(data.smb.id));
      expect(parameter.get("produk"), kategori).toBe(data.kode.gor);
      expect(parameter.get("rincian"), kategori).toBe(nilaiRincian(data.smb.id, data.kode.gor, kategori));
    }
  });
});

describe("toko acuan tanpa varian di periode sumber", () => {
  beforeAll(async () => {
    const hasil = await tetapkanPeriodeSumber({ idGudang: bandung, bulan: [data.bulanTanpaSmb], idPengguna: idAdmin });
    if (hasil.keadaan !== "berhasil") throw new Error(hasil.pesan);
    const hitung = await hitungDraftRencana({ idGudang: bandung, tanggalKirim, idPengguna: idOperator });
    if (hitung.keadaan !== "berhasil") throw new Error(hitung.pesan);
  });

  const pesan = () => golden.tokoAcuanTanpaVarian.pesan.replace(golden.tokoAcuanTanpaVarian.tokoAcuan, data.smb.nama);

  it(`ringkasan per toko dan bagian toko menampilkan "${golden.tokoAcuanTanpaVarian.pesan}", dan finalisasi tertahan`, async () => {
    const html = await bukaToko(data.tokoBaru.id);
    const ringkasan = new RegExp(`<tr[^>]*data-ringkasan-toko="${data.tokoBaru.id}".*?</tr>`).exec(html)?.[0] ?? "";
    expect(ringkasan).toMatch(/data-tanpa-varian[^>]*>.*?lucide-triangle-alert/);
    expect(teksTerbaca(ringkasan)).toContain(pesan());
    const bagian = new RegExp(`<section[^>]*data-draft-toko="${data.tokoBaru.id}".*?</section>`).exec(html)?.[0] ?? "";
    expect(teksTerbaca(/<p[^>]*data-tanpa-varian[^>]*>.*?<\/p>/.exec(bagian)?.[0] ?? "")).toBe(pesan());
    const tertahan = new RegExp(`<p[^>]*data-finalisasi-tertahan="${data.tokoBaru.id}"[^>]*>.*?</p>`).exec(html)?.[0] ?? "";
    expect(teksTerbaca(tertahan)).toBe(`Belum bisa difinalisasi: ${pesan().charAt(0).toLowerCase()}${pesan().slice(1)}`);
  });

  it("toko tanpa toko acuan dan tanpa varian (SMB) tetap memakai teks lama", async () => {
    const html = await bukaToko(data.smb.id);
    const ringkasan = new RegExp(`<tr[^>]*data-ringkasan-toko="${data.smb.id}".*?</tr>`).exec(html)?.[0] ?? "";
    expect(teksTerbaca(ringkasan)).toContain("Tidak ada varian dari periode sumber untuk toko ini");
    expect(teksTerbaca(ringkasan)).not.toContain("toko acuan");
  });
});
