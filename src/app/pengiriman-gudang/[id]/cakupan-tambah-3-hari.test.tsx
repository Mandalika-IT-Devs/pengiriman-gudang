import { readFileSync } from "node:fs";
import { join } from "node:path";

import { and, eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { formatTanggal, parseTanggalBisnis } from "@/domain/kalender";
import { buatPenggunaUji, kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { jadwalToko } from "@/server/db/schema";
import { bacaDraftRencana, hitungDraftRencana } from "@/server/gudang/draft-rencana";
import { daftarHakTindakan } from "@/server/gudang/hak-tindakan";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { finalisasiRencanaToko } from "@/server/gudang/rencana-final";
import { simpanStokToko } from "@/server/gudang/stok-draft";
import { bersihkanTokoSmbUji, siapkanTokoSmbUji } from "@/server/gudang/uji-bantu-cakupan";
import { idGudangUji } from "@/server/gudang/uji-bantu";

const kepala = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));
vi.mock("next/navigation", async (asli) => ({
  ...(await asli<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import HalamanPengirimanGudang from "./page";
import HalamanRincianRencanaFinal from "@/app/riwayat/rencana-final/[idRencana]/page";

// T143 — PRD A5 ▶ Keputusan 2026-10-27 (Tampilan): toko yang jadwal tetapnya bertanda "Tambah 3 hari cakupan" mendapat teks
// cakupan berujung "+ tambahan 3 hari" (dengan bantuan istilah) di draft, rincian baris, dan rincian rencana final.
// Daftar "Tanggal cakupan" memuat semua tanggal termasuk 3 tanggal tambahan, tanpa penanda khusus. Contoh pemilik:
// mingguan Kamis (H−1), kirim Kamis 29-10-2026. Checkbox admin dibuat di T144, jadi tandanya diubah langsung di data.

const golden = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../tests/golden/tambah-3-hari-cakupan.json"), "utf8")) as {
  kasusContohPemilik: { tanggalKirim: string; tanggalCakupan: { tanggal: string }[]; teksCakupan: string };
};
const contoh = golden.kasusContohPemilik;
const tanggalKirim = parseTanggalBisnis(contoh.tanggalKirim);

let bandung: number;
let toko: { id: number; nama: string };
let kodeProduk: string;
let idOperator: string;

beforeAll(async () => {
  const idAdmin = (await buatPenggunaUji("admin")).id;
  bandung = await idGudangUji("Gudang Bandung");
  ({ toko, kodeProduk } = await siapkanTokoSmbUji({ idGudang: bandung, idAdmin }));
  await db
    .update(jadwalToko)
    .set({ pola: "mingguan", hariKirim: [{ hari: "Kamis", persiapanHari: 1 }], tambah3HariCakupan: true })
    .where(and(eq(jadwalToko.tokoId, toko.id), eq(jadwalToko.status, "aktif")));
  const operator = await kepalaPenggunaUji("viewer");
  await tugaskanOperator({ idPengguna: operator.id, idGudang: bandung, hakTindakan: [...daftarHakTindakan] });
  kepala.cookie = operator.cookie;
  idOperator = operator.id;
  const hasil = await hitungDraftRencana({ idGudang: bandung, tanggalKirim, idPengguna: idOperator });
  if (hasil.keadaan !== "berhasil") throw new Error(hasil.pesan);
}, 120_000);

afterAll(async () => {
  await bersihkanTokoSmbUji({ idGudang: bandung, idToko: toko.id });
});

const bukaToko = async (tambahan: Record<string, string> = {}) =>
  renderToStaticMarkup(
    await HalamanPengirimanGudang({
      params: Promise.resolve({ id: String(bandung) }),
      searchParams: Promise.resolve({ tanggal: contoh.tanggalKirim, toko: String(toko.id), ...tambahan }),
    }),
  );

/** Teks yang terbaca: tanpa tombol bantuan istilah (berlabel aria-label saja) dan tanpa tag. */
const teksTerbaca = (html: string) => html.replace(/<button[^>]*>.*?<\/button>/g, "").replace(/<[^>]+>/g, "");

const bagianRincian = (html: string) =>
  new RegExp(`<section[^>]*data-rincian-baris="${toko.id}\\|${kodeProduk}".*?</section>`).exec(html)?.[0] ?? "";

/** Teks cakupan pertama sesudah `penanda` beserta tombol bantuan istilah di dalamnya. */
const teksCakupanSesudah = (html: string, penanda: string) =>
  new RegExp(`${penanda}.*?(<span data-teks-cakupan="[^"]*">.*?</span>)`).exec(html)?.[1] ?? "";

describe("teks cakupan toko bertanda Tambah 3 hari cakupan di tampilan", () => {
  it(`header toko draft: ${contoh.teksCakupan}, dengan bantuan istilah di "tambahan 3 hari"`, async () => {
    const teks = teksCakupanSesudah(await bukaToko(), `data-draft-toko="${toko.id}"`);
    expect(teks).toContain(`data-teks-cakupan="${contoh.teksCakupan}"`);
    expect(teksTerbaca(teks)).toBe(contoh.teksCakupan);
    expect(teks).toMatch(
      /tambahan 3 hari<button[^>]*aria-label="Apa itu Tambah 3 hari cakupan\?"[^>]*data-bantuan-istilah="tambah3HariCakupan"/,
    );
  });

  it("rincian baris: 11 tanggal cakupan 28-10 s.d. 07-11-2026 tanpa penanda khusus, dan teks cakupan dengan tambahannya", async () => {
    const rincian = bagianRincian(await bukaToko({ rincian: `${toko.id}|${kodeProduk}` }));
    const awal = formatTanggal(parseTanggalBisnis(contoh.tanggalCakupan[0].tanggal));
    const akhir = formatTanggal(parseTanggalBisnis(contoh.tanggalCakupan.at(-1)?.tanggal ?? ""));
    expect(teksTerbaca(rincian)).toContain(`${awal} – ${akhir} · ${contoh.teksCakupan}`);
    const tanggal = [...rincian.matchAll(/<li[^>]*data-tanggal-cakupan="([^"]+)"/g)].map((m) => m[1]);
    expect(tanggal).toEqual(contoh.tanggalCakupan.map((t) => t.tanggal));
    // Tanpa penanda khusus: setiap butir tanggal cakupan berbentuk sama (tanggal, kategori, sumber, rata-rata).
    const butir = [...rincian.matchAll(/<li[^>]*data-tanggal-cakupan="[^"]+"[^>]*>(.*?)<\/li>/g)].map((m) => m[1]);
    expect(butir.filter((b) => /tambah/i.test(b))).toEqual([]);
  });

  it("rincian rencana final: Pola Mingguan · +3 hari cakupan dan teks cakupan dengan tambahannya", async () => {
    expect(await simpanStokToko({ idGudang: bandung, tanggalKirim, tokoId: toko.id, stok: [{ kodeProduk, stokAkhir: 20 }] })).toEqual({
      keadaan: "berhasil",
    });
    const versiDilihat = (await bacaDraftRencana(bandung, tanggalKirim))?.toko.find((t) => t.id === toko.id)?.versi ?? "";
    const hasil = await finalisasiRencanaToko({ idGudang: bandung, tanggalKirim, tokoId: toko.id, idPengguna: idOperator, versiDilihat });
    if (hasil.keadaan !== "berhasil") throw new Error(hasil.pesan);

    const html = renderToStaticMarkup(
      await HalamanRincianRencanaFinal({
        params: Promise.resolve({ idRencana: String(hasil.idRencana) }),
        searchParams: Promise.resolve({}),
      }),
    );
    const jadwal = new RegExp(`<section[^>]*data-dasar="jadwal".*?</section>`).exec(html)?.[0] ?? "";
    expect(jadwal).toMatch(/<dt[^>]*>Pola<\/dt><dd>Mingguan · \+3 hari cakupan<\/dd>/);
    expect(teksTerbaca(jadwal)).toContain(contoh.teksCakupan);
    const kalender = new RegExp(`<section[^>]*data-dasar="kalender".*?</section>`).exec(html)?.[0] ?? "";
    expect([...kalender.matchAll(/data-tanggal-cakupan="([^"]+)"/g)].map((m) => m[1])).toEqual(contoh.tanggalCakupan.map((t) => t.tanggal));
  });
});
