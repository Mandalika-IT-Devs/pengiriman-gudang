import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TeksCakupan, teksCakupan } from "./teks-cakupan";

// T121 (DESIGN §11.6): teks cakupan ditulis lengkap; p = 0 tanpa bagian persiapan.

const teksTerbaca = (html: string) => html.replace(/<button[^>]*>.*?<\/button>/g, "").replace(/<[^>]+>/g, "").replaceAll("&amp;", "&");

describe("teks cakupan", () => {
  it("p = 1, L = 7 → Cakupan 8 hari: persiapan 1 hari + 7 hari sampai sebelum kiriman berikutnya", () => {
    expect(teksCakupan(1, 7, "mingguan")).toBe("Cakupan 8 hari: persiapan 1 hari + 7 hari sampai sebelum kiriman berikutnya");
    expect(teksTerbaca(renderToStaticMarkup(<TeksCakupan persiapanHari={1} panjangCakupan={7} polaJadwal="mingguan" />))).toBe(
      "Cakupan 8 hari: persiapan 1 hari + 7 hari sampai sebelum kiriman berikutnya",
    );
  });

  it("p = 0, L = 3 → tanpa bagian persiapan", () => {
    expect(teksCakupan(0, 3, "2x-seminggu")).toBe("Cakupan 3 hari: 3 hari sampai sebelum kiriman berikutnya");
    const html = renderToStaticMarkup(<TeksCakupan persiapanHari={0} panjangCakupan={3} polaJadwal="2x-seminggu" />);
    expect(teksTerbaca(html)).toBe("Cakupan 3 hari: 3 hari sampai sebelum kiriman berikutnya");
    expect(html).not.toContain("persiapan");
  });

  it("bantuan istilah di samping Cakupan, persiapan, dan panjang cakupan", () => {
    const html = renderToStaticMarkup(<TeksCakupan persiapanHari={2} panjangCakupan={14} polaJadwal="dua-mingguan" />);
    expect([...html.matchAll(/data-bantuan-istilah="([^"]+)"/g)].map((m) => m[1])).toEqual(["cakupan", "persiapan", "panjangCakupan"]);
  });
});

// T135 — PRD A5 ▶ Revisi 2026-10-19 (Cakupan): teks cakupan toko dua mingguan menyebut dua minggu, bukan "sampai sebelum
// kiriman berikutnya". Pola lain tidak berubah.
describe("teks cakupan toko dua mingguan", () => {
  it("BXC Rabu (H−1), L = 14 → Cakupan 15 hari: persiapan 1 hari + 14 hari (dua minggu)", () => {
    expect(teksCakupan(1, 14, "dua-mingguan")).toBe("Cakupan 15 hari: persiapan 1 hari + 14 hari (dua minggu)");
    const html = renderToStaticMarkup(<TeksCakupan persiapanHari={1} panjangCakupan={14} polaJadwal="dua-mingguan" />);
    expect(teksTerbaca(html)).toBe("Cakupan 15 hari: persiapan 1 hari + 14 hari (dua minggu)");
    expect(html).toContain('data-teks-cakupan="Cakupan 15 hari: persiapan 1 hari + 14 hari (dua minggu)"');
  });

  it("p = 0 → Cakupan 14 hari: 14 hari (dua minggu)", () => {
    expect(teksCakupan(0, 14, "dua-mingguan")).toBe("Cakupan 14 hari: 14 hari (dua minggu)");
  });

  it("pola lain dengan L = 14 tetap sampai sebelum kiriman berikutnya (1× sebulan dengan pengiriman di luar jadwal)", () => {
    expect(teksCakupan(0, 14, "1x-sebulan")).toBe("Cakupan 14 hari: 14 hari sampai sebelum kiriman berikutnya");
  });

  it("rencana final dua mingguan lama dengan L selain 14 (aturan sebelum 19-10-2026) tetap sampai sebelum kiriman berikutnya", () => {
    expect(teksCakupan(0, 3, "dua-mingguan")).toBe("Cakupan 3 hari: 3 hari sampai sebelum kiriman berikutnya");
  });
});
