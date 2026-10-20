import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTanggalBisnis } from "@/domain/kalender";
import { muatIsiBeranda } from "@/server/beranda/isi-beranda";
import { AksesDitolakError, wajibGudangDenganHak, wajibHakTindakan } from "@/server/auth/kewenangan";
import { kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { daftarHakTindakan } from "@/server/gudang/hak-tindakan";
import { tetapkanAktifGudang } from "@/server/gudang/kelola-gudang";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { buatGudangUji, buatTokoUji, hapusGudangUji, idGudangUji, rencanaFinalUji } from "@/server/gudang/uji-bantu";

const kepala = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));
vi.mock("next/navigation", async (asli) => ({
  ...(await asli<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import HalamanRiwayat from "@/app/riwayat/page";
import HalamanRincianRencanaFinal from "@/app/riwayat/rencana-final/[idRencana]/page";

import HalamanPengirimanGudang from "./[id]/page";
import HalamanDaftarPengirimanGudang from "./page";

// T110 (PRD A3 ▶ Revisi 2026-10-13): gudang nonaktif tidak muncul di pilihan kerja; penugasan operator ke gudang
// nonaktif tidak memberi akses. Admin tetap bisa membuka halaman Pengiriman Gudang gudang nonaktif (hanya-baca) dengan
// badge Nonaktif. T127: riwayat rencana final ada di halaman Riwayat, termasuk untuk gudang nonaktif (dengan penanda),
// tanpa membuka halaman kerja gudang itu. T136 (PRD A7 ▶ Revisi 2026-10-20): riwayat gudang nonaktif hanya terlihat oleh
// admin; penugasan ke gudang nonaktif tidak memberi akses ke riwayatnya.

let nonaktif: { id: number; nama: string };
let bali: number;
let bandung: number;

beforeAll(async () => {
  bali = await idGudangUji("Gudang Bali");
  bandung = await idGudangUji("Gudang Bandung");
  nonaktif = await buatGudangUji();
});

beforeEach(() => {
  kepala.cookie = "";
});

afterAll(async () => {
  await hapusGudangUji(nonaktif.id);
});

const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
const daftar = async () => renderToStaticMarkup(await HalamanDaftarPengirimanGudang());
const halaman = async (id: number) => renderToStaticMarkup(await HalamanPengirimanGudang(params(id)));
const riwayat = async (id: number) => renderToStaticMarkup(await HalamanRiwayat({ searchParams: Promise.resolve({ gudang: String(id) }) }));

/** Operator dengan kelima hak tindakan di gudang uji, yang lalu dinonaktifkan. */
async function operatorGudangNonaktif() {
  const operator = await kepalaPenggunaUji("viewer");
  await tetapkanAktifGudang(nonaktif.id, true);
  await tugaskanOperator({ idPengguna: operator.id, idGudang: nonaktif.id, hakTindakan: [...daftarHakTindakan] });
  await expect(tetapkanAktifGudang(nonaktif.id, false)).resolves.toEqual({ keadaan: "berhasil" });
  return operator;
}

describe("operator yang ditugaskan ke gudang nonaktif", () => {
  it("tidak melihatnya di daftar dan mendapat 404 saat membuka halamannya", async () => {
    const operator = await operatorGudangNonaktif();
    kepala.cookie = operator.cookie;

    // Satu-satunya penugasan di gudang nonaktif → tidak punya akses Pengiriman Gudang sama sekali.
    await expect(HalamanDaftarPengirimanGudang()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
    await expect(HalamanPengirimanGudang(params(nonaktif.id))).rejects.toMatchObject({ digest: expect.stringContaining("404") });

    // Dengan penugasan lain di gudang aktif, gudang aktif itu satu-satunya gudang yang bisa dibuka: operator langsung
    // diarahkan ke sana (T118), bukan ke gudang nonaktif.
    await tugaskanOperator({ idPengguna: operator.id, idGudang: bali, hakTindakan: [] });
    await expect(HalamanDaftarPengirimanGudang()).rejects.toMatchObject({
      digest: expect.stringContaining(`;/pengiriman-gudang/${bali};`),
    });

    // Dengan dua gudang aktif, daftar hanya berisi gudang aktif itu.
    await tugaskanOperator({ idPengguna: operator.id, idGudang: bandung, hakTindakan: [] });
    const html = await daftar();
    expect(html).toContain(`href="/pengiriman-gudang/${bali}"`);
    expect(html).toContain(`href="/pengiriman-gudang/${bandung}"`);
    expect(html).not.toContain(`href="/pengiriman-gudang/${nonaktif.id}"`);
    expect(html).not.toContain(nonaktif.nama);
  });

  it("pemeriksaan kewenangan di server menolak semua hak tindakannya; halaman usulan/jadwal tidak menawarkannya", async () => {
    const operator = await operatorGudangNonaktif();
    kepala.cookie = operator.cookie;

    for (const tindakan of daftarHakTindakan) {
      await expect(wajibHakTindakan(nonaktif.id, tindakan)).rejects.toBeInstanceOf(AksesDitolakError);
    }
    await expect(wajibGudangDenganHak("kelola-usulan-jadwal")).rejects.toBeInstanceOf(AksesDitolakError);
  });

  it("kartu beranda operator mengabaikan penugasan ke gudang nonaktif", async () => {
    const operator = await operatorGudangNonaktif();
    const isi = await muatIsiBeranda(
      { id: operator.id, nama: "Uji viewer", email: operator.email, peran: "viewer" },
      parseTanggalBisnis("2026-10-14"),
    );
    expect(isi.gudangDitugaskan).toEqual([]);
    expect(isi.peran).toBe("viewer");
  });

  it("setelah gudang diaktifkan kembali, penugasannya memberi akses lagi", async () => {
    const operator = await operatorGudangNonaktif();
    kepala.cookie = operator.cookie;
    await tetapkanAktifGudang(nonaktif.id, true);
    await expect(wajibHakTindakan(nonaktif.id, "finalisasi")).resolves.toMatchObject({ id: operator.id });
    expect(await halaman(nonaktif.id)).toContain(`Pengiriman Gudang — ${nonaktif.nama}`);
    await tetapkanAktifGudang(nonaktif.id, false);
  });
});

describe("admin dan gudang nonaktif", () => {
  it("tetap bisa melihat (hanya-baca) dengan badge Nonaktif: daftar dan halaman gudang", async () => {
    await tetapkanAktifGudang(nonaktif.id, false);
    const admin = await kepalaPenggunaUji("admin");
    // Admin yang juga ditugaskan sebelum gudang dinonaktifkan tetap hanya-baca.
    await tetapkanAktifGudang(nonaktif.id, true);
    await tugaskanOperator({ idPengguna: admin.id, idGudang: nonaktif.id, hakTindakan: [...daftarHakTindakan] });
    await tetapkanAktifGudang(nonaktif.id, false);
    kepala.cookie = admin.cookie;

    const kartu = (await daftar()).match(new RegExp(`<a [^>]*href="/pengiriman-gudang/${nonaktif.id}"[^>]*>(.*?)</a>`))?.[1] ?? "";
    expect(kartu).toContain(nonaktif.nama);
    expect(kartu).toContain('data-status="gudangNonaktif"');
    expect(kartu).toContain("Hanya-baca");

    const html = await halaman(nonaktif.id);
    expect(html).toContain(`Pengiriman Gudang — ${nonaktif.nama}`);
    expect(html).toContain('data-status="gudangNonaktif"');
    expect(html).toContain("data-hanya-baca");

    for (const tindakan of daftarHakTindakan) {
      await expect(wajibHakTindakan(nonaktif.id, tindakan)).rejects.toBeInstanceOf(AksesDitolakError);
    }
  });

  it("gudang aktif tidak memakai badge Nonaktif", async () => {
    kepala.cookie = (await kepalaPenggunaUji("admin")).cookie;
    expect(await halaman(bali)).not.toContain('data-status="gudangNonaktif"');
  });
});

describe("riwayat rencana final gudang nonaktif (T127, T136)", () => {
  it("admin melihat rencana finalnya dengan penanda Nonaktif; operator gudang lain, operator yang ditugaskan ke gudang nonaktif itu, dan viewer tidak", async () => {
    const admin = await kepalaPenggunaUji("admin");
    const toko = await buatTokoUji();
    await tetapkanAktifGudang(nonaktif.id, true);
    const idRencana = await rencanaFinalUji({ idGudang: nonaktif.id, idToko: toko.id, tanggalKirim: "2030-05-06", idPengguna: admin.id });
    await tetapkanAktifGudang(nonaktif.id, false);
    const baris = (html: string) => new RegExp(`<tr[^>]*data-rencana-final="${idRencana}".*?</tr>`).exec(html)?.[0] ?? "";
    const rincian = async () =>
      renderToStaticMarkup(
        await HalamanRincianRencanaFinal({ params: Promise.resolve({ idRencana: String(idRencana) }), searchParams: Promise.resolve({}) }),
      );
    const tidakDitemukan = { digest: expect.stringContaining("404") };

    kepala.cookie = admin.cookie;
    const html = await riwayat(nonaktif.id);
    // Nama gudang dari snapshot rencana final ("UJI", lihat rencanaFinalUji), penanda dari status gudang sekarang.
    expect(baris(html)).toMatch(/<td[^>]*><div[^>]*><span>UJI<\/span><span[^>]*data-status="gudangNonaktif"/);
    // Gudang nonaktif tidak memberi hak ekspor.
    expect(baris(html)).not.toContain("data-ekspor-url");
    // Pilihan filter gudang memuat gudang nonaktif dengan keterangannya.
    expect(html).toContain(`${nonaktif.nama} (nonaktif)`);
    expect(await rincian()).toContain('data-status="gudangNonaktif"');
    expect(await rincian()).not.toContain("data-ekspor-url");

    // Operator gudang lain: `?gudang=<nonaktif>` di luar cakupan berarti "Semua gudang" dalam cakupannya; rincian 404.
    const operatorBali = await kepalaPenggunaUji("viewer");
    await tugaskanOperator({ idPengguna: operatorBali.id, idGudang: bali, hakTindakan: [...daftarHakTindakan] });
    kepala.cookie = operatorBali.cookie;
    expect(baris(await riwayat(nonaktif.id))).toBe("");
    await expect(rincian()).rejects.toMatchObject(tidakDitemukan);

    // Penugasan ke gudang nonaktif tidak memberi akses; tanpa gudang lain, Riwayat 404. Viewer juga 404.
    const operatorNonaktif = await operatorGudangNonaktif();
    const viewer = await kepalaPenggunaUji("viewer");
    for (const cookie of [operatorNonaktif.cookie, viewer.cookie]) {
      kepala.cookie = cookie;
      await expect(riwayat(nonaktif.id)).rejects.toMatchObject(tidakDitemukan);
      await expect(rincian()).rejects.toMatchObject(tidakDitemukan);
    }
    // Riwayat tidak membuka halaman kerja gudang nonaktif bagi bukan admin.
    kepala.cookie = viewer.cookie;
    await expect(HalamanPengirimanGudang(params(nonaktif.id))).rejects.toMatchObject(tidakDitemukan);
  });
});
