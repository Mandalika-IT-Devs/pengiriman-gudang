import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { rincianJumlahKirim } from "./angka";
import { kirimanSebelumnyaBelumSampaiToko, periksaJadwal, tanggalKirimMenurutToko, type Jadwal, type MasukanJadwal } from "./jadwal";
import { formatTanggal, parseTanggalBisnis, type KategoriDasar } from "./kalender";
import { cakupanPengiriman, hitungKebutuhanKirim } from "./pengiriman";

// T143 — PRD A5 ▶ Keputusan 2026-10-27 dan A6 ▶ Keputusan 2026-10-27: toko yang jadwal tetapnya bertanda "Tambah 3 hari
// cakupan" mendapat cakupan H−p sampai H+L−1+3 (p + L + 3 hari) di setiap pengirimannya, rutin maupun di luar jadwal. L,
// tanggal kirim toko, dan peringatan "kiriman sebelumnya belum sampai" tidak berubah.

type JadwalFixture = MasukanJadwal & { tambah3HariCakupan: boolean };

type DiLuarJadwalFixture = { tanggalKirim: string; persiapanHari: 0 | 1 | 2; tanggalRutinDipindah: string | null };

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "../../tests/golden/tambah-3-hari-cakupan.json"), "utf8")) as {
  kasusContohPemilik: {
    jadwal: JadwalFixture;
    diLuarJadwal: DiLuarJadwalFixture[];
    tanggalKirim: string;
    persiapanHari: number;
    panjangCakupan: number;
    rataRata: Record<KategoriDasar, number>;
    tanggalCakupan: { tanggal: string; hari: string; kategoriEfektif: string }[];
    jumlahHari: number;
    kebutuhan: number;
    jumlahKirim: { persenBuffer: number; stokAkhir: number; stokTarget: number; jumlahKirim: number };
    tanpaTambahan: { akhirCakupan: string; jumlahHari: number; kebutuhan: number; stokTarget: number; jumlahKirim: number };
  };
  kasusCakupan: {
    nama: string;
    jadwal: JadwalFixture;
    diLuarJadwal: DiLuarJadwalFixture[];
    tanggalKirim: string;
    persiapanHari: number;
    panjangCakupan: number;
    awalCakupan: string;
    akhirCakupan: string;
    jumlahHari: number;
    kirimanSebelumnyaBelumSampai: string | null;
  }[];
};

const t = parseTanggalBisnis;

/** Sumber tanggal kirim toko dari fixture: jadwal tetap (dengan tandanya) dan pengiriman di luar jadwal yang berlaku. */
function tokoDari({ jadwal, diLuarJadwal }: { jadwal: JadwalFixture; diLuarJadwal: DiLuarJadwalFixture[] }) {
  const { tambah3HariCakupan, ...masukan } = jadwal;
  const hasil = periksaJadwal(masukan);
  if (hasil.keadaan !== "valid") throw new Error(`jadwal contoh harus valid: ${hasil.pesan.join("; ")}`);
  const jadwalTetap: Jadwal = { ...hasil.jadwal, tambah3HariCakupan };
  return {
    jadwal: jadwalTetap,
    diLuarJadwal: diLuarJadwal.map((p) => ({
      tanggalKirim: t(p.tanggalKirim),
      persiapanHari: p.persiapanHari,
      tanggalRutinDipindah: p.tanggalRutinDipindah === null ? null : t(p.tanggalRutinDipindah),
    })),
  };
}

/** p, L, tanda, dan tanggal cakupan pengiriman `tanggalKirim` menurut tanggal kirim toko. */
function pengirimanPada(toko: ReturnType<typeof tokoDari>, tanggalKirim: string) {
  const hasil = tanggalKirimMenurutToko(toko, t(tanggalKirim));
  if (!hasil.kirim) throw new Error(`${tanggalKirim} harus tanggal kirim toko`);
  const cakupan = cakupanPengiriman({
    tanggalKirim: t(tanggalKirim),
    persiapanHari: hasil.persiapanHari,
    panjangCakupan: hasil.panjangCakupan,
    tambah3HariCakupan: hasil.tambah3HariCakupan,
    toko: "UJI",
    daftarPerubahan: [],
  });
  return { ...hasil, cakupan };
}

describe("cakupan toko bertanda Tambah 3 hari cakupan (golden tambah-3-hari-cakupan kasusCakupan)", () => {
  for (const kasus of fixture.kasusCakupan) {
    it(`${kasus.nama}: ${kasus.tanggalKirim} → ${kasus.awalCakupan} s.d. ${kasus.akhirCakupan}, ${kasus.jumlahHari} hari`, () => {
      const toko = tokoDari(kasus);
      const hasil = pengirimanPada(toko, kasus.tanggalKirim);
      expect({
        persiapanHari: hasil.persiapanHari,
        panjangCakupan: hasil.panjangCakupan,
        awalCakupan: hasil.cakupan[0]?.tanggal,
        akhirCakupan: hasil.cakupan.at(-1)?.tanggal,
        jumlahHari: hasil.cakupan.length,
        kirimanSebelumnyaBelumSampai: kirimanSebelumnyaBelumSampaiToko(toko, t(kasus.tanggalKirim)),
      }).toEqual({
        persiapanHari: kasus.persiapanHari,
        panjangCakupan: kasus.panjangCakupan,
        awalCakupan: kasus.awalCakupan,
        akhirCakupan: kasus.akhirCakupan,
        jumlahHari: kasus.jumlahHari,
        kirimanSebelumnyaBelumSampai: kasus.kirimanSebelumnyaBelumSampai,
      });
    });
  }
});

describe("contoh pemilik: mingguan Kamis (H−1), kirim Kamis 29-10-2026 (golden kasusContohPemilik)", () => {
  const kasus = fixture.kasusContohPemilik;
  const { jumlahKirim: kirim, tanpaTambahan } = kasus;

  /** Kebutuhan dan jumlah kirim produk otomatis untuk jadwal kasus dengan tanda `tambah3HariCakupan`. */
  function hitung(tambah3HariCakupan: boolean) {
    const toko = tokoDari({ ...kasus, jadwal: { ...kasus.jadwal, tambah3HariCakupan } });
    const pengiriman = pengirimanPada(toko, kasus.tanggalKirim);
    const hasil = hitungKebutuhanKirim({
      tanggalKirim: t(kasus.tanggalKirim),
      persiapanHari: pengiriman.persiapanHari,
      panjangCakupan: pengiriman.panjangCakupan,
      tambah3HariCakupan: pengiriman.tambah3HariCakupan,
      toko: "UJI",
      daftarPerubahan: [],
      rataRata: kasus.rataRata,
      produk: { kode: "PW110P-GOR", kategori: "PARFUM WANITA" },
      stokAkhir: kirim.stokAkhir,
      persenBuffer: kirim.persenBuffer,
    });
    if (!hasil.kebutuhan.tersedia) throw new Error("kebutuhan harus tersedia");
    const rincian = rincianJumlahKirim(hasil.kebutuhan.kebutuhan, kirim.stokAkhir, kirim.persenBuffer, "stok-target");
    return { pengiriman, hasil, kebutuhan: hasil.kebutuhan.kebutuhan, rincian };
  }

  it(`p dan L tidak berubah: p = ${kasus.persiapanHari}, L = ${kasus.panjangCakupan}`, () => {
    expect(hitung(true).pengiriman).toMatchObject({ persiapanHari: kasus.persiapanHari, panjangCakupan: kasus.panjangCakupan });
  });

  it(`${kasus.jumlahHari} tanggal cakupan dengan kategori efektifnya, termasuk 3 hari tambahan`, () => {
    const { hasil } = hitung(true);
    expect(
      hasil.cakupan.map(({ tanggal, kategoriEfektif }) => ({ tanggal, hari: formatTanggal(tanggal).split(",")[0], kategoriEfektif })),
    ).toEqual(kasus.tanggalCakupan);
    expect(hasil.cakupan).toHaveLength(kasus.jumlahHari);
  });

  it(`kebutuhan ${kasus.kebutuhan}, stok target ${kirim.stokTarget}, jumlah kirim ${kirim.jumlahKirim}`, () => {
    const { kebutuhan, rincian, hasil } = hitung(true);
    expect({ kebutuhan, stokTarget: rincian.stokTarget, jumlahKirim: rincian.jumlahKirim }).toEqual({
      kebutuhan: kasus.kebutuhan,
      stokTarget: kirim.stokTarget,
      jumlahKirim: kirim.jumlahKirim,
    });
    expect(hasil).toMatchObject({ status: "siap", jumlahKirim: kirim.jumlahKirim });
  });

  it(`tanpa tanda: akhir cakupan ${tanpaTambahan.akhirCakupan}, ${tanpaTambahan.jumlahHari} hari, kebutuhan ${tanpaTambahan.kebutuhan}, jumlah kirim ${tanpaTambahan.jumlahKirim}`, () => {
    const { pengiriman, kebutuhan, rincian } = hitung(false);
    expect({
      akhirCakupan: pengiriman.cakupan.at(-1)?.tanggal,
      jumlahHari: pengiriman.cakupan.length,
      kebutuhan,
      stokTarget: rincian.stokTarget,
      jumlahKirim: rincian.jumlahKirim,
    }).toEqual({
      akhirCakupan: tanpaTambahan.akhirCakupan,
      jumlahHari: tanpaTambahan.jumlahHari,
      kebutuhan: tanpaTambahan.kebutuhan,
      stokTarget: tanpaTambahan.stokTarget,
      jumlahKirim: tanpaTambahan.jumlahKirim,
    });
  });
});
