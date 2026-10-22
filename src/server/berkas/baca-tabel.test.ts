import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { bacaTabel } from "./baca-tabel";

// T139 (PRD A6 ▶ Keputusan 2026-10-22): pemisah CSV (koma, titik koma, atau tab) dikenali otomatis dari baris pertama.
// Semua isi file di sini sintetis; ekspor kasir asli tidak di-commit.

const utf8 = (teks: string) => new TextEncoder().encode(teks);

describe("bacaTabel: pemisah CSV dikenali dari baris pertama", () => {
  it("CSV koma dengan judul kolom persis ekspor kasir (8 kolom, LF)", () => {
    const isi = [
      "Name - Variant,Category,Beginning,Purchase Order,Sales,Transfer,Adjustment,Ending",
      "GORGEOUS TUBEROSE - 110ML M PARFUM,PARFUM WANITA,25,0,5,0,0,20",
      "NO1 - 10ML ATOMIZER,PARFUM PRIA,7,0,0,0,0,7",
    ].join("\n");
    expect(bacaTabel("Inventory Summary - TOKO UJI.csv", utf8(isi))).toEqual({
      ok: true,
      baris: [
        ["Name - Variant", "Category", "Beginning", "Purchase Order", "Sales", "Transfer", "Adjustment", "Ending"],
        ["GORGEOUS TUBEROSE - 110ML M PARFUM", "PARFUM WANITA", "25", "0", "5", "0", "0", "20"],
        ["NO1 - 10ML ATOMIZER", "PARFUM PRIA", "7", "0", "0", "0", "0", "7"],
      ],
    });
  });

  it("CSV titik koma dengan BOM dan CRLF tetap terbaca seperti sebelumnya (baris kosong di akhir = satu sel kosong)", () => {
    const isi = [
      "\uFEFFName - Variant;Category;Ending",
      "GORGEOUS TUBEROSE - 10ML ATOMIZER;PARFUM WANITA;",
      "HOLY SWEET - 2ML EDP;PARFUM WANITA;abc",
      "",
    ].join("\r\n");
    expect(bacaTabel("ENDING STOK.CSV", utf8(isi))).toEqual({
      ok: true,
      baris: [
        ["Name - Variant", "Category", "Ending"],
        ["GORGEOUS TUBEROSE - 10ML ATOMIZER", "PARFUM WANITA", ""],
        ["HOLY SWEET - 2ML EDP", "PARFUM WANITA", "abc"],
        [""],
      ],
    });
  });

  it("contoh e2e tests/e2e/file-stok-contoh.csv (titik koma, CRLF) tetap terbaca seperti sebelumnya", () => {
    const isi = readFileSync(join(import.meta.dirname, "../../../tests/e2e/file-stok-contoh.csv"));
    expect(bacaTabel("file-stok-contoh.csv", new Uint8Array(isi))).toEqual({
      ok: true,
      baris: [
        ["Name - Variant", "Category", "Ending"],
        ["GORGEOUS TUBEROSE - 110ML M PARFUM", "PARFUM WANITA", "20"],
        ["GORGEOUS TUBEROSE - 10ML ATOMIZER", "PARFUM WANITA", ""],
        ["BACCARAT ELIXIR - 2ML EDP", "PARFUM WANITA", "3"],
        ["NO1 - 10ML ATOMIZER", "PARFUM PRIA", "7"],
        ["HOLY SWEET - 2ML EDP", "PARFUM WANITA", "abc"],
        [""],
      ],
    });
  });

  it("CSV tab", () => {
    const isi = ["Nama di file stok\tKode produk", "GORGEOUS TUBEROSE - 110ML M PARFUM\tPW110P-GOR", "NO1 - 10ML ATOMIZER\tA10M-NO1"].join(
      "\n",
    );
    expect(bacaTabel("alias.csv", utf8(isi))).toEqual({
      ok: true,
      baris: [
        ["Nama di file stok", "Kode produk"],
        ["GORGEOUS TUBEROSE - 110ML M PARFUM", "PW110P-GOR"],
        ["NO1 - 10ML ATOMIZER", "A10M-NO1"],
      ],
    });
  });

  it('nilai berkutip yang memuat koma di file koma tetap satu sel ("" = satu tanda kutip)', () => {
    const isi = 'Name - Variant,Category,Ending\n"GIFT SET A, B",PARFUM WANITA,5\n"HAMPERS ""X, Y""",HAMPERS,2';
    expect(bacaTabel("stok.csv", utf8(isi))).toEqual({
      ok: true,
      baris: [
        ["Name - Variant", "Category", "Ending"],
        ["GIFT SET A, B", "PARFUM WANITA", "5"],
        ['HAMPERS "X, Y"', "HAMPERS", "2"],
      ],
    });
  });

  it("nilai berkutip yang memuat titik koma di file titik koma tetap satu sel", () => {
    const isi = 'Name - Variant;Category;Ending\r\n"GIFT SET A; B";PARFUM WANITA;5';
    expect(bacaTabel("stok.csv", utf8(isi))).toEqual({
      ok: true,
      baris: [
        ["Name - Variant", "Category", "Ending"],
        ["GIFT SET A; B", "PARFUM WANITA", "5"],
      ],
    });
  });

  it("pemisah di dalam tanda kutip di baris pertama tidak ikut dihitung", () => {
    // Di luar kutip: 1 koma (titik koma 2, tetapi di dalam kutip) → koma.
    const koma = '"Nama; ukuran; varian",Kode produk\n"A; 10ML; X",K-1';
    expect(bacaTabel("alias.csv", utf8(koma))).toEqual({
      ok: true,
      baris: [
        ["Nama; ukuran; varian", "Kode produk"],
        ["A; 10ML; X", "K-1"],
      ],
    });
    // Di luar kutip: 1 titik koma (koma 2, tetapi di dalam kutip) → titik koma.
    const titikKoma = '"Nama, ukuran, varian";Kode produk\n"A, 10ML, X";K-1';
    expect(bacaTabel("alias.csv", utf8(titikKoma))).toEqual({
      ok: true,
      baris: [
        ["Nama, ukuran, varian", "Kode produk"],
        ["A, 10ML, X", "K-1"],
      ],
    });
  });

  it("jumlah pemisah seri → titik koma, lalu koma, lalu tab; pemisah terpilih dipakai untuk semua baris", () => {
    expect(bacaTabel("a.csv", utf8("A;B,C\nD;E,F"))).toEqual({
      ok: true,
      baris: [
        ["A", "B,C"],
        ["D", "E,F"],
      ],
    });
    expect(bacaTabel("a.csv", utf8("A,B\tC\nD,E\tF"))).toEqual({
      ok: true,
      baris: [
        ["A", "B\tC"],
        ["D", "E\tF"],
      ],
    });
    expect(bacaTabel("a.csv", utf8("A\tB;C\nD\tE;F"))).toEqual({
      ok: true,
      baris: [
        ["A\tB", "C"],
        ["D\tE", "F"],
      ],
    });
    expect(bacaTabel("a.csv", utf8("A;B,C\tD"))).toEqual({ ok: true, baris: [["A", "B,C\tD"]] });
  });

  it("baris pertama tanpa pemisah (di luar tanda kutip) → setiap baris dibaca sebagai satu kolom", () => {
    expect(bacaTabel("stok.csv", utf8("Name - Variant Category Ending\nA;B,C\tD\n"))).toEqual({
      ok: true,
      baris: [["Name - Variant Category Ending"], ["A;B,C\tD"], [""]],
    });
    expect(bacaTabel("stok.csv", utf8('"Name - Variant,Category,Ending"\n"A,B,1"'))).toEqual({
      ok: true,
      baris: [["Name - Variant,Category,Ending"], ["A,B,1"]],
    });
    expect(bacaTabel("kosong.csv", new Uint8Array())).toEqual({ ok: true, baris: [[""]] });
  });
});

describe("bacaTabel: jenis file dari ekstensi", () => {
  it("ekstensi selain .csv dan .xlsx ditolak dengan pesan format file", () => {
    const isi = utf8("Name - Variant,Category,Ending\nA,B,1");
    for (const nama of ["stok.txt", "stok.tsv", "stok.xls", "stok"]) {
      expect(bacaTabel(nama, isi), nama).toEqual({ ok: false, pesan: "Format file harus CSV atau .xlsx." });
    }
  });
});
