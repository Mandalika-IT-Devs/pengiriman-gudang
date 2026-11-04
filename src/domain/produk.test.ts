import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { klasifikasiProduk } from "./produk";

// T145 — PRD A6 ▶ Keputusan 2026-11-04, ADR-0012: produk display menjadi produk manual. Golden pengganti
// `klasifikasi-produk.json` (ADR-0007).

type KasusKlasifikasi = {
  kode: string;
  kategori: string;
  klasifikasi: string;
  alasan?: string;
};

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "../../tests/golden/klasifikasi-produk-2026-11-04.json"), "utf8")) as {
  kasus: KasusKlasifikasi[];
};

describe("klasifikasiProduk (golden klasifikasi-produk-2026-11-04)", () => {
  it.each(fixture.kasus)("$kode ($kategori) → $klasifikasi $alasan", (kasus) => {
    const harapan =
      kasus.alasan === undefined ? { klasifikasi: kasus.klasifikasi } : { klasifikasi: kasus.klasifikasi, alasan: kasus.alasan };

    expect(klasifikasiProduk(kasus.kode, kasus.kategori)).toStrictEqual(harapan);
  });
});
