import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTanggalBisnis } from "@/domain/kalender";
import { buatPenggunaUji, kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { bacaDraftRencana, hitungDraftRencana } from "@/server/gudang/draft-rencana";
import { aturJadwalTetap } from "@/server/gudang/jadwal";
import { ubahNamaToko } from "@/server/gudang/kelola-toko";
import { bacaRencanaFinal, finalisasiRencanaToko } from "@/server/gudang/rencana-final";
import { simpanStokToko } from "@/server/gudang/stok-draft";
import { buatGudangUji, hapusGudangUji, salinRencanaFinalDenganJadwal } from "@/server/gudang/uji-bantu";
import { bersihkanTokoAcuanUji, siapkanTokoAcuanUji } from "@/server/gudang/uji-bantu-toko-acuan";

const kepala = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));

import HalamanRincianRencanaFinal from "./rencana-final/[idRencana]/page";

// T152 — PRD A5 ▶ Keputusan 2026-11-04 (toko acuan: Perubahan dan peralihan, Tampilan) dan A7 (snapshot finalisasi):
// rencana final menyimpan toko acuan yang dipakai saat finalisasi (id dan nama saat itu) di snapshot jadwalnya, dan
// rinciannya menulis Pola "<pola> · toko acuan <B>". Contoh golden `toko-acuan.json`: TOKO BARU, mingguan Kamis (H−1),
// toko acuan SMB, kirim Kamis 29-10-2026. Gudang uji sendiri, supaya draft hanya memuat toko berkas ini.

type Golden = { kasusKebutuhan: { tanggalKirim: string } };
const golden = JSON.parse(readFileSync(join(import.meta.dirname, "../../../tests/golden/toko-acuan.json"), "utf8")) as Golden;
const KAMIS = parseTanggalBisnis(golden.kasusKebutuhan.tanggalKirim);

let idAdmin: string;
let idOperator: string;
let idGudang: number;
let data: Awaited<ReturnType<typeof siapkanTokoAcuanUji>>;
/** Nama SMB saat finalisasi. */
let namaSmb: string;
/** Id rencana final TOKO BARU dan SMB, kirim Kamis 29-10-2026. */
const rencana = { tokoBaru: 0, smb: 0 };

async function finalisasi(tokoId: number) {
  const stok = [
    { kodeProduk: data.kode.gor, stokAkhir: 20 },
    { kodeProduk: data.kode.nol, stokAkhir: 0 },
  ];
  const simpan = await simpanStokToko({ idGudang, tanggalKirim: KAMIS, tokoId, stok });
  if (simpan.keadaan !== "berhasil") throw new Error(simpan.pesan);
  const versiDilihat = (await bacaDraftRencana(idGudang, KAMIS))?.toko.find((t) => t.id === tokoId)?.versi ?? "";
  const hasil = await finalisasiRencanaToko({ idGudang, tanggalKirim: KAMIS, tokoId, idPengguna: idOperator, versiDilihat });
  if (hasil.keadaan !== "berhasil") throw new Error(hasil.pesan);
  return hasil.idRencana;
}

beforeAll(async () => {
  idAdmin = (await buatPenggunaUji("admin")).id;
  idOperator = (await buatPenggunaUji("viewer")).id;
  idGudang = (await buatGudangUji()).id;
  data = await siapkanTokoAcuanUji({ idGudang, idAdmin });
  namaSmb = data.smb.nama;
  const hitung = await hitungDraftRencana({ idGudang, tanggalKirim: KAMIS, idPengguna: idOperator });
  if (hitung.keadaan !== "berhasil") throw new Error(hitung.pesan);
  rencana.tokoBaru = await finalisasi(data.tokoBaru.id);
  rencana.smb = await finalisasi(data.smb.id);
}, 180_000);

afterAll(async () => {
  await bersihkanTokoAcuanUji({ idGudang, idToko: [data.smb.id, data.tokoBaru.id, data.lmk.id] });
  await hapusGudangUji(idGudang);
});

beforeEach(async () => {
  kepala.cookie = (await kepalaPenggunaUji("admin")).cookie;
});

const bukaRincian = async (idRencana: number) =>
  renderToStaticMarkup(
    await HalamanRincianRencanaFinal({ params: Promise.resolve({ idRencana: String(idRencana) }), searchParams: Promise.resolve({}) }),
  );
const bagianJadwal = (html: string) => /<section[^>]*data-dasar="jadwal".*?<\/section>/.exec(html)?.[0] ?? "";
const pola = (html: string) => /<dt[^>]*>Pola<\/dt><dd>(.*?)<\/dd>/.exec(bagianJadwal(html))?.[1];

describe("finalisasi TOKO BARU dengan toko acuan SMB", () => {
  it("snapshot jadwal rencana final menyimpan toko acuan SMB (id dan nama saat finalisasi)", async () => {
    expect((await bacaRencanaFinal(idGudang, rencana.tokoBaru))?.jadwal.tokoAcuan).toEqual({ id: data.smb.id, nama: namaSmb });
  });

  it('rincian rencana final menampilkan Pola "Mingguan · toko acuan SMB"', async () => {
    expect(pola(await bukaRincian(rencana.tokoBaru))).toBe(`Mingguan · toko acuan ${namaSmb}`);
  });

  it('dengan tambah 3 hari cakupan, penanda toko acuan menyusul: "Mingguan · +3 hari cakupan · toko acuan SMB"', async () => {
    const idBertanda = await salinRencanaFinalDenganJadwal({
      idRencana: rencana.tokoBaru,
      tanggalKirim: "2026-10-22",
      ubahJadwal: (jadwal) => ({ ...jadwal, tambah3HariCakupan: true }),
    });
    expect(pola(await bukaRincian(idBertanda))).toBe(`Mingguan · +3 hari cakupan · toko acuan ${namaSmb}`);
  });
});

describe("rencana final tanpa toko acuan tampil seperti sekarang", () => {
  it('SMB (tanpa toko acuan): snapshot tanpa toko acuan, Pola "Mingguan"', async () => {
    expect((await bacaRencanaFinal(idGudang, rencana.smb))?.jadwal).not.toHaveProperty("tokoAcuan");
    const html = await bukaRincian(rencana.smb);
    expect(pola(html)).toBe("Mingguan");
    expect(html).not.toContain("toko acuan");
  });

  it("rencana final dari sebelum T152 (snapshot jadwal tanpa toko acuan) tampil tanpa penanda toko acuan", async () => {
    const idLama = await salinRencanaFinalDenganJadwal({
      idRencana: rencana.tokoBaru,
      tanggalKirim: "2026-10-15",
      ubahJadwal: ({ pola, hariKirim, tanggalJangkar, tambah3HariCakupan }) => ({ pola, hariKirim, tanggalJangkar, tambah3HariCakupan }),
    });
    const html = await bukaRincian(idLama);
    expect(pola(html)).toBe("Mingguan");
    expect(html).not.toContain("toko acuan");
  });
});

describe("snapshot tidak ikut berubah", () => {
  it('setelah SMB diganti nama dan toko acuan TOKO BARU dihapus, rincian tetap menampilkan "toko acuan SMB"', async () => {
    const namaBaru = `UJI-${randomUUID()}`;
    expect(await ubahNamaToko(data.smb.id, namaBaru)).toEqual({ keadaan: "berhasil" });
    expect(
      await aturJadwalTetap({
        idGudang,
        idToko: data.tokoBaru.id,
        masukan: { pola: "mingguan", hariKirim: [{ hari: "Kamis", persiapan: "H-1" }] },
        idTokoAcuan: null,
        idPengguna: idAdmin,
        hariIni: KAMIS,
      }),
    ).toEqual({ keadaan: "berhasil" });

    expect((await bacaRencanaFinal(idGudang, rencana.tokoBaru))?.jadwal.tokoAcuan).toEqual({ id: data.smb.id, nama: namaSmb });
    const html = await bukaRincian(rencana.tokoBaru);
    expect(pola(html)).toBe(`Mingguan · toko acuan ${namaSmb}`);
    expect(html).not.toContain(namaBaru);
  });
});
