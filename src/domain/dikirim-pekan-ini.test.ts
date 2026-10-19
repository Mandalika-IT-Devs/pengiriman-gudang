import { describe, expect, it } from "vitest";

import { nilaiAwalDikirimPekanIni } from "./dikirim-pekan-ini";
import { periksaJadwal, punyaPilihanDikirimPekanIni, type Jadwal, type MasukanJadwal } from "./jadwal";
import { parseTanggalBisnis } from "./kalender";

// PRD A5 ▶ Revisi 2026-10-19, "Dikirim pekan ini": nilai awal pilihan toko dua mingguan dari kirim terakhir. "Dikirim"
// jika belum ada rencana final sebelum tanggal itu, atau kirim terakhirnya 14 hari atau lebih sebelum tanggal itu; selain
// itu "Tidak dikirim pekan ini". Contoh PRD: kirim terakhir Rabu 21-10-2026 → Rabu 28-10 Tidak dikirim (7 hari), Rabu 04-11
// Dikirim (14 hari).

const t = parseTanggalBisnis;

function jadwalValid(masukan: MasukanJadwal): Jadwal {
  const hasil = periksaJadwal(masukan);
  if (hasil.keadaan !== "valid") throw new Error(`jadwal contoh harus valid: ${hasil.pesan.join("; ")}`);
  return hasil.jadwal;
}

describe("nilai awal Dikirim pekan ini dari kirim terakhir (PRD A5 ▶ Revisi 2026-10-19)", () => {
  it("contoh PRD: kirim terakhir Rabu 21-10-2026 → Rabu 28-10-2026 Tidak dikirim pekan ini (7 hari)", () => {
    expect(nilaiAwalDikirimPekanIni(t("2026-10-28"), t("2026-10-21"))).toEqual({ dikirim: false, selisihHari: 7 });
  });

  it("contoh PRD: kirim terakhir Rabu 21-10-2026 → Rabu 04-11-2026 Dikirim (14 hari)", () => {
    expect(nilaiAwalDikirimPekanIni(t("2026-11-04"), t("2026-10-21"))).toEqual({ dikirim: true, selisihHari: 14 });
  });

  it("belum ada rencana final sebelum tanggal itu → Dikirim, tanpa selisih", () => {
    expect(nilaiAwalDikirimPekanIni(t("2026-10-28"), null)).toEqual({ dikirim: true, selisihHari: null });
  });

  it("13 hari sebelumnya → Tidak dikirim pekan ini; lebih dari 14 hari → Dikirim", () => {
    expect(nilaiAwalDikirimPekanIni(t("2026-11-03"), t("2026-10-21"))).toEqual({ dikirim: false, selisihHari: 13 });
    expect(nilaiAwalDikirimPekanIni(t("2026-11-11"), t("2026-10-21"))).toEqual({ dikirim: true, selisihHari: 21 });
  });

  it("kirim terakhir harus sebelum tanggal kirim", () => {
    expect(() => nilaiAwalDikirimPekanIni(t("2026-10-21"), t("2026-10-21"))).toThrow(RangeError);
  });
});

// Pilihan hanya untuk toko dua mingguan pada tanggal kirim rutinnya; pengiriman di luar jadwal dan pola lain tidak punya
// pilihan (PRD A5 ▶ Revisi 2026-10-19). Tanggal kirim rutin dua mingguan = setiap tanggal yang jatuh pada hari kirimnya
// (T135, tanpa tanggal jangkar). Contoh BXC: dua mingguan Rabu (H−1).
describe("punya pilihan dikirim pekan ini: toko dua mingguan pada tanggal kirim rutinnya", () => {
  const bxc = jadwalValid({ pola: "dua-mingguan", hariKirim: [{ hari: "Rabu", persiapan: "H-1" }] });
  const mingguan = jadwalValid({ pola: "mingguan", hariKirim: [{ hari: "Rabu", persiapan: "H-1" }] });

  it("setiap tanggal kirim rutin dua mingguan (Rabu 21-10, 28-10, dan 04-11-2026) punya pilihan", () => {
    expect(punyaPilihanDikirimPekanIni({ jadwal: bxc, diLuarJadwal: [] }, t("2026-10-21"))).toBe(true);
    expect(punyaPilihanDikirimPekanIni({ jadwal: bxc, diLuarJadwal: [] }, t("2026-10-28"))).toBe(true);
    expect(punyaPilihanDikirimPekanIni({ jadwal: bxc, diLuarJadwal: [] }, t("2026-11-04"))).toBe(true);
  });

  it("bukan tanggal kirim toko itu (Kamis 29-10-2026) tidak punya pilihan", () => {
    expect(punyaPilihanDikirimPekanIni({ jadwal: bxc, diLuarJadwal: [] }, t("2026-10-29"))).toBe(false);
  });

  it("pengiriman di luar jadwal toko dua mingguan tidak punya pilihan; tanggal rutin yang dipindah juga tidak", () => {
    const tambahan = { tanggalKirim: t("2026-10-22"), persiapanHari: 1 as const, tanggalRutinDipindah: null };
    expect(punyaPilihanDikirimPekanIni({ jadwal: bxc, diLuarJadwal: [tambahan] }, t("2026-10-22"))).toBe(false);
    const pindah = { tanggalKirim: t("2026-10-29"), persiapanHari: 1 as const, tanggalRutinDipindah: t("2026-10-28") };
    expect(punyaPilihanDikirimPekanIni({ jadwal: bxc, diLuarJadwal: [pindah] }, t("2026-10-28"))).toBe(false);
    expect(punyaPilihanDikirimPekanIni({ jadwal: bxc, diLuarJadwal: [pindah] }, t("2026-10-29"))).toBe(false);
  });

  it("pola lain tidak punya pilihan, juga pada tanggal kirimnya; toko tanpa jadwal tetap juga tidak", () => {
    expect(punyaPilihanDikirimPekanIni({ jadwal: mingguan, diLuarJadwal: [] }, t("2026-10-28"))).toBe(false);
    expect(punyaPilihanDikirimPekanIni({ jadwal: null, diLuarJadwal: [] }, t("2026-10-28"))).toBe(false);
  });
});
