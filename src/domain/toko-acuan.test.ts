import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  nonaktifkanToko,
  sumberVarianDanRataRata,
  validasiTokoAcuan,
  type MasukanNonaktifkanToko,
  type MasukanValidasiTokoAcuan,
} from "./toko-acuan";

// T149 — PRD A5 ▶ Keputusan 2026-11-04 (toko acuan, "Saat menyimpan"): toko acuan harus toko lain yang aktif, tidak
// memakai toko acuan sendiri, dan toko ini tidak boleh sedang menjadi toko acuan toko lain (tidak berantai).
// T150 — PRD A5 ▶ Keputusan 2026-11-04 ("Menonaktifkan toko"): toko yang sedang menjadi toko acuan di jadwal tetap aktif
// toko lain tidak bisa dinonaktifkan.
// T151 — PRD A5 ▶ Keputusan 2026-11-04 (Perhitungan, Tampilan): draft memakai varian dan rata-rata toko acuan bila ada,
// selain itu toko itu sendiri; catatan "data penjualan sendiri" tampil bila toko bertoko acuan sudah punya data sendiri.

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "../../tests/golden/toko-acuan.json"), "utf8")) as {
  validasiTokoAcuan: (MasukanValidasiTokoAcuan & { nama: string; hasil: "sah" | "ditolak"; pesan?: string })[];
  nonaktifkanToko: (MasukanNonaktifkanToko & { nama: string; hasil: "boleh" | "ditolak"; pesan?: string })[];
  sumberVarianDanRataRata: {
    nama: string;
    toko: string;
    tokoAcuan: string | null;
    punyaDataSendiri: boolean;
    sumber: string;
    catatanDataSendiri: boolean;
  }[];
};

describe("validasiTokoAcuan (golden toko-acuan.json)", () => {
  it.each(fixture.validasiTokoAcuan)("$nama", ({ toko, tokoAcuan, dipakaiSebagaiAcuanOleh, hasil, pesan }) => {
    expect(validasiTokoAcuan({ toko, tokoAcuan, dipakaiSebagaiAcuanOleh })).toEqual(pesan === undefined ? { hasil } : { hasil, pesan });
  });
});

describe("nonaktifkanToko (golden toko-acuan.json)", () => {
  it.each(fixture.nonaktifkanToko)("$nama", ({ toko, dipakaiSebagaiAcuanOleh, hasil, pesan }) => {
    expect(nonaktifkanToko({ toko, dipakaiSebagaiAcuanOleh })).toEqual(pesan === undefined ? { hasil } : { hasil, pesan });
  });
});

describe("sumberVarianDanRataRata (golden toko-acuan.json)", () => {
  it.each(fixture.sumberVarianDanRataRata)("$nama", ({ toko, tokoAcuan, punyaDataSendiri, sumber, catatanDataSendiri }) => {
    expect(sumberVarianDanRataRata({ toko, tokoAcuan, punyaDataSendiri })).toEqual({ sumber, catatanDataSendiri });
  });
});
