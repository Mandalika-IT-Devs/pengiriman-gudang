import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { PenggunaMasuk } from "@/server/auth/kewenangan";
import { buatPenggunaUji, kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { gudang as tabelGudang, pengirimanDiLuarJadwal, rencanaFinal } from "@/server/db/schema";
import { daftarHakTindakan, type HakTindakan } from "@/server/gudang/hak-tindakan";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { buatGudangUji, buatTokoUji, hapusGudangUji, rencanaFinalUji } from "@/server/gudang/uji-bantu";

const kepala = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));

import { hasilFilterDiLuarJadwal, hasilFilterRencanaFinal } from "./hasil-filter";
import { cakupanLihatRiwayat } from "./muat";
import HalamanRiwayat from "./page";
import HalamanRincianRencanaFinal from "./rencana-final/[idRencana]/page";

// T136 (PRD A7 ▶ Revisi 2026-10-20, DESIGN §6 ▶ Revisi 2026-10-20): Riwayat mengikuti penugasan. Admin melihat riwayat
// semua gudang (termasuk nonaktif); pengguna bukan admin hanya gudang yang boleh ia lihat di Pengiriman Gudang
// (penugasan apa pun di gudang aktif, termasuk tanpa hak tindakan). Viewer tanpa gudang seperti itu mendapat 404.
//
// Data: gudang A, B (aktif, berisi riwayat), C (aktif, tanpa riwayat), dan N (nonaktif, berisi riwayat).
// Rencana final: toko X di A dan B, toko Y di B, toko Z di N. Pengiriman di luar jadwal: X di A, Y di B, Z di N.

let gudangA: { id: number; nama: string };
let gudangB: { id: number; nama: string };
let gudangC: { id: number; nama: string };
let gudangN: { id: number; nama: string };
let tokoX: { id: number; nama: string };
let tokoY: { id: number; nama: string };
let tokoZ: { id: number; nama: string };
const rencana = { xA: 0, xB: 0, yB: 0, zN: 0 };
const pengiriman = { xA: 0, yB: 0, zN: 0 };
type Sesi = { pengguna: PenggunaMasuk; cookie: string };
/** Pengguna uji dan cookie sesinya. */
const sesi: Record<"admin" | "viewer" | "operatorA" | "operatorLihatA" | "operatorAN" | "operatorN" | "operatorC", Sesi> = Object.create(null);

async function masuk(peran: "admin" | "viewer", penugasan: { idGudang: number; hakTindakan: HakTindakan[] }[] = []): Promise<Sesi> {
  const { id, email, cookie } = await kepalaPenggunaUji(peran);
  for (const p of penugasan) {
    const hasil = await tugaskanOperator({ idPengguna: id, ...p });
    if (hasil.keadaan !== "berhasil") throw new Error(hasil.pesan);
  }
  return { pengguna: { id, email, nama: `Uji ${peran}`, peran }, cookie };
}

beforeAll(async () => {
  [gudangA, gudangB, gudangC, gudangN] = [await buatGudangUji(), await buatGudangUji(), await buatGudangUji(), await buatGudangUji()];
  [tokoX, tokoY, tokoZ] = [await buatTokoUji(), await buatTokoUji(), await buatTokoUji()];
  const admin = await buatPenggunaUji("admin");
  const final = async (g: { id: number; nama: string }, t: { id: number; nama: string }) => {
    const idRencana = await rencanaFinalUji({ idGudang: g.id, idToko: t.id, tanggalKirim: "2097-03-02", idPengguna: admin.id });
    await db.update(rencanaFinal).set({ namaGudang: g.nama, namaToko: t.nama }).where(eq(rencanaFinal.id, idRencana));
    return idRencana;
  };
  rencana.xA = await final(gudangA, tokoX);
  rencana.xB = await final(gudangB, tokoX);
  rencana.yB = await final(gudangB, tokoY);
  rencana.zN = await final(gudangN, tokoZ);

  const dasar = { persiapanHari: 1 as const, alasan: "permintaan mendesak", diusulkanOleh: admin.id, jenis: "tambahan" as const, status: "menunggu" as const };
  const [xA, yB, zN] = await db
    .insert(pengirimanDiLuarJadwal)
    .values([
      { ...dasar, gudangId: gudangA.id, tokoId: tokoX.id, tanggalKirim: "2097-03-03" },
      { ...dasar, gudangId: gudangB.id, tokoId: tokoY.id, tanggalKirim: "2097-03-04" },
      { ...dasar, gudangId: gudangN.id, tokoId: tokoZ.id, tanggalKirim: "2097-03-05" },
    ])
    .returning({ id: pengirimanDiLuarJadwal.id });
  Object.assign(pengiriman, { xA: xA.id, yB: yB.id, zN: zN.id });

  sesi.admin = await masuk("admin");
  sesi.viewer = await masuk("viewer");
  sesi.operatorA = await masuk("viewer", [{ idGudang: gudangA.id, hakTindakan: [...daftarHakTindakan] }]);
  sesi.operatorLihatA = await masuk("viewer", [{ idGudang: gudangA.id, hakTindakan: [] }]);
  sesi.operatorAN = await masuk("viewer", [
    { idGudang: gudangA.id, hakTindakan: [] },
    { idGudang: gudangN.id, hakTindakan: [...daftarHakTindakan] },
  ]);
  sesi.operatorN = await masuk("viewer", [{ idGudang: gudangN.id, hakTindakan: [...daftarHakTindakan] }]);
  sesi.operatorC = await masuk("viewer", [{ idGudang: gudangC.id, hakTindakan: [...daftarHakTindakan] }]);
  // Penugasan dibuat saat gudang N masih aktif, lalu gudang dinonaktifkan (PRD A3 ▶ Revisi 2026-10-13).
  await db.update(tabelGudang).set({ aktif: false }).where(eq(tabelGudang.id, gudangN.id));
}, 120_000);

afterAll(async () => {
  await hapusGudangUji(gudangA.id, gudangB.id, gudangC.id, gudangN.id);
});

beforeEach(() => {
  kepala.cookie = "";
});

const buka = async (parameter: Record<string, string> = {}) => renderToStaticMarkup(await HalamanRiwayat({ searchParams: Promise.resolve(parameter) }));
const bukaRincian = async (idRencana: number) =>
  renderToStaticMarkup(await HalamanRincianRencanaFinal({ params: Promise.resolve({ idRencana: String(idRencana) }), searchParams: Promise.resolve({}) }));
const idRencanaDiDaftar = (html: string) => [...html.matchAll(/<tr[^>]*data-rencana-final="(\d+)"/g)].map((m) => Number(m[1]));
const idPengirimanDiDaftar = (html: string) => [...html.matchAll(/<tr[^>]*data-pengiriman="(\d+)"/g)].map((m) => Number(m[1]));
const barisRencana = (html: string, id: number) => new RegExp(`<tr[^>]*data-rencana-final="${id}".*?</tr>`).exec(html)?.[0] ?? "";
const barisPengiriman = (html: string, id: number) => new RegExp(`<tr[^>]*data-pengiriman="${id}".*?</tr>`).exec(html)?.[0] ?? "";
/** Label pilihan yang sedang diterapkan di isian filter `label` (nilai yang tampil di tombol pilihan). */
const terapanFilter = (html: string, label: "Gudang" | "Toko") =>
  new RegExp(`<span id="([^"]+)">${label}</span><button[^>]*aria-labelledby="\\1"[^>]*><span[^>]*>([^<]*)</span>`).exec(html)?.[2];
const tidakDitemukan = (promise: Promise<unknown>) => expect(promise).rejects.toMatchObject({ digest: expect.stringContaining("404") });
const masukSebagai = (s: Sesi) => (kepala.cookie = s.cookie);
const id = (daftar: readonly { id: number }[]) => daftar.map((d) => d.id);

describe("Riwayat operator satu gudang (T136)", () => {
  it("tab Rencana final dan tab Di luar jadwal hanya berisi baris gudang penugasannya", async () => {
    masukSebagai(sesi.operatorA);
    expect(idRencanaDiDaftar(await buka())).toEqual([rencana.xA]);
    expect(idPengirimanDiDaftar(await buka({ tab: "di-luar-jadwal" }))).toEqual([pengiriman.xA]);
  });

  it("pilihan filter Gudang hanya gudang penugasannya; pilihan Toko hanya toko yang punya riwayat di gudang itu", async () => {
    const cakupan = await cakupanLihatRiwayat(sesi.operatorA.pengguna);
    expect(cakupan).toEqual([gudangA.id]);
    const rencanaFinal = await hasilFilterRencanaFinal({}, cakupan);
    expect(rencanaFinal?.pilihan.gudang).toEqual([{ id: gudangA.id, nama: gudangA.nama, aktif: true }]);
    expect(id(rencanaFinal?.pilihan.toko ?? [])).toEqual([tokoX.id]);
    const diLuarJadwal = await hasilFilterDiLuarJadwal({}, cakupan);
    expect(diLuarJadwal?.pilihan.gudang).toEqual([{ id: gudangA.id, nama: gudangA.nama, aktif: true }]);
    expect(id(diLuarJadwal?.pilihan.toko ?? [])).toEqual([tokoX.id]);

    masukSebagai(sesi.operatorA);
    const html = await buka({ gudang: String(gudangA.id), toko: String(tokoX.id) });
    expect(terapanFilter(html, "Gudang")).toBe(gudangA.nama);
    expect(terapanFilter(html, "Toko")).toBe(tokoX.nama);
    // Toko Y hanya punya riwayat di gudang B: bukan pilihan, jadi berarti "Semua toko".
    const tokoLain = await buka({ toko: String(tokoY.id) });
    expect(terapanFilter(tokoLain, "Toko")).toBe("Semua toko");
    expect(idRencanaDiDaftar(tokoLain)).toEqual([rencana.xA]);
  });

  it("?gudang=<id> di luar cakupan diperlakukan sebagai Semua gudang di kedua tab", async () => {
    masukSebagai(sesi.operatorA);
    const rencanaFinal = await buka({ gudang: String(gudangB.id) });
    expect(terapanFilter(rencanaFinal, "Gudang")).toBe("Semua gudang");
    expect(idRencanaDiDaftar(rencanaFinal)).toEqual([rencana.xA]);
    const diLuarJadwal = await buka({ tab: "di-luar-jadwal", gudang: String(gudangB.id) });
    expect(terapanFilter(diLuarJadwal, "Gudang")).toBe("Semua gudang");
    expect(idPengirimanDiDaftar(diLuarJadwal)).toEqual([pengiriman.xA]);
  });

  it("keadaan kosong dihitung dari cakupan: gudang penugasan tanpa riwayat → keadaan kosong walau gudang lain punya riwayat", async () => {
    masukSebagai(sesi.operatorC);
    const rencanaFinal = await buka();
    expect(rencanaFinal).toContain("Belum ada rencana final.");
    expect(rencanaFinal).not.toContain("<table");
    const diLuarJadwal = await buka({ tab: "di-luar-jadwal" });
    expect(diLuarJadwal).toContain("Belum ada pengiriman di luar jadwal.");
    expect(diLuarJadwal).not.toContain("<table");
  });

  it("rincian rencana final gudangnya terbuka; rincian gudang lain → 404", async () => {
    masukSebagai(sesi.operatorA);
    expect(await bukaRincian(rencana.xA)).toContain("<h1");
    await tidakDitemukan(bukaRincian(rencana.xB));
    await tidakDitemukan(bukaRincian(rencana.yB));
    await tidakDitemukan(bukaRincian(rencana.zN));
  });
});

describe("Riwayat dengan penugasan tanpa hak tindakan (T136)", () => {
  it("melihat riwayat gudang itu di kedua tab dan rinciannya, tanpa tombol ekspor", async () => {
    masukSebagai(sesi.operatorLihatA);
    const rencanaFinal = await buka();
    expect(idRencanaDiDaftar(rencanaFinal)).toEqual([rencana.xA]);
    expect(rencanaFinal).not.toContain("data-ekspor-url");
    const diLuarJadwal = await buka({ tab: "di-luar-jadwal" });
    expect(idPengirimanDiDaftar(diLuarJadwal)).toEqual([pengiriman.xA]);
    expect(diLuarJadwal).not.toContain("data-ekspor-url");
    const rincian = await bukaRincian(rencana.xA);
    expect(rincian).toContain("<h1");
    expect(rincian).not.toContain("data-ekspor-url");
  });
});

describe("Riwayat dan penugasan ke gudang nonaktif (T136)", () => {
  it("penugasan ke gudang nonaktif tidak memberi akses ke riwayat gudang itu", async () => {
    masukSebagai(sesi.operatorAN);
    expect(idRencanaDiDaftar(await buka())).toEqual([rencana.xA]);
    expect(idRencanaDiDaftar(await buka({ gudang: String(gudangN.id) }))).toEqual([rencana.xA]);
    expect(idPengirimanDiDaftar(await buka({ tab: "di-luar-jadwal" }))).toEqual([pengiriman.xA]);
    await tidakDitemukan(bukaRincian(rencana.zN));
  });

  it("hanya ditugaskan ke gudang nonaktif → /riwayat dan rinciannya 404", async () => {
    masukSebagai(sesi.operatorN);
    await tidakDitemukan(buka());
    await tidakDitemukan(buka({ tab: "di-luar-jadwal" }));
    await tidakDitemukan(bukaRincian(rencana.zN));
  });
});

describe("Riwayat viewer (T136)", () => {
  it("viewer tanpa penugasan: /riwayat (kedua tab) dan rincian rencana final → 404", async () => {
    masukSebagai(sesi.viewer);
    await tidakDitemukan(buka());
    await tidakDitemukan(buka({ tab: "di-luar-jadwal" }));
    await tidakDitemukan(bukaRincian(rencana.xA));
  });
});

describe("Riwayat admin (T136)", () => {
  it("admin tanpa penugasan melihat riwayat semua gudang; gudang nonaktif bertanda Nonaktif", async () => {
    masukSebagai(sesi.admin);
    expect(idRencanaDiDaftar(await buka({ toko: String(tokoX.id) })).sort((a, b) => a - b)).toEqual([rencana.xA, rencana.xB]);
    expect(idRencanaDiDaftar(await buka({ gudang: String(gudangB.id) })).sort((a, b) => a - b)).toEqual([rencana.xB, rencana.yB]);
    const nonaktif = await buka({ gudang: String(gudangN.id) });
    expect(idRencanaDiDaftar(nonaktif)).toEqual([rencana.zN]);
    expect(barisRencana(nonaktif, rencana.zN)).toContain('data-status="gudangNonaktif"');
    const diLuarJadwal = await buka({ tab: "di-luar-jadwal", gudang: String(gudangN.id) });
    expect(idPengirimanDiDaftar(diLuarJadwal)).toEqual([pengiriman.zN]);
    expect(barisPengiriman(diLuarJadwal, pengiriman.zN)).toContain('data-status="gudangNonaktif"');
    expect(await bukaRincian(rencana.zN)).toContain('data-status="gudangNonaktif"');

    const cakupan = await cakupanLihatRiwayat(sesi.admin.pengguna);
    expect(cakupan).toEqual(expect.arrayContaining([gudangA.id, gudangB.id, gudangC.id, gudangN.id]));
    const pilihan = (await hasilFilterRencanaFinal({}, cakupan))?.pilihan;
    expect(pilihan?.gudang).toEqual(expect.arrayContaining([{ id: gudangN.id, nama: gudangN.nama, aktif: false }]));
    expect(id(pilihan?.toko ?? [])).toEqual(expect.arrayContaining([tokoX.id, tokoY.id, tokoZ.id]));
  });
});
