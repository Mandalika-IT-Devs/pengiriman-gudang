import { readFileSync } from "node:fs";
import { join } from "node:path";

import { inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { klasifikasiProduk } from "@/domain/produk";
import { db } from "@/server/db";
import { produk } from "@/server/db/schema";
import { pernyataanMigrasi } from "@/server/db/uji-bantu";

import { type Tx } from "./antrean";
import { kodeProdukUji } from "./uji-bantu";

// T145 — PRD A6 ▶ Keputusan 2026-11-04 (Data yang sudah ada), ADR-0012: migrasi 0033 menghitung ulang klasifikasi dan
// alasan manual semua produk yang sudah tersimpan dengan aturan baru, satu kali. Database test sudah dimigrasi dari
// kosong, jadi pernyataan UPDATE migrasi itu dijalankan lagi di atas data "sebelum migrasi" buatan test ini. Semuanya
// berjalan dalam transaksi yang dibatalkan: UPDATE mengenai seluruh tabel produk, dan berkas test lain tidak boleh
// melihat sisanya.

const BERKAS_MIGRASI = "0033_produk_display_manual.sql";

type KasusGolden = { kode: string; kategori: string; klasifikasi: "manual" | "otomatis"; alasan?: string };
const golden = JSON.parse(readFileSync(join(import.meta.dirname, "../../../tests/golden/klasifikasi-produk-2026-11-04.json"), "utf8")) as {
  kasus: KasusGolden[];
};

/** Pernyataan UPDATE `produk` di migrasi 0033. */
function pernyataanHitungUlang() {
  const pernyataan = pernyataanMigrasi(BERKAS_MIGRASI).filter((p) => p.startsWith('UPDATE "produk"'));
  expect(pernyataan).toHaveLength(1);
  return pernyataan[0];
}

class TransaksiDibatalkan extends Error {}

/** Menjalankan `isi` dalam transaksi yang selalu dibatalkan, lalu mengembalikan hasilnya. */
async function dalamTransaksiDibatalkan<T>(isi: (tx: Tx) => Promise<T>): Promise<T> {
  let hasil: { nilai: T } | undefined;
  try {
    await db.transaction(async (tx) => {
      hasil = { nilai: await isi(tx) };
      throw new TransaksiDibatalkan();
    });
  } catch (e) {
    if (!(e instanceof TransaksiDibatalkan)) throw e;
  }
  if (hasil === undefined) throw new Error("Transaksi tidak berjalan.");
  return hasil.nilai;
}

type ProdukSebelum = Pick<typeof produk.$inferInsert, "kode" | "kategori" | "klasifikasi" | "alasanManual">;

/** Menulis produk dengan klasifikasi "sebelum migrasi" (kode yang sudah ada ditimpa), menjalankan UPDATE migrasi, lalu membaca hasilnya. */
async function migrasikan(tx: Tx, daftar: ProdukSebelum[]) {
  for (const p of daftar) {
    const isi = { ...p, nama: `NAMA ${p.kode}`, ukuran: "120ML" };
    await tx
      .insert(produk)
      .values(isi)
      .onConflictDoUpdate({
        target: produk.kode,
        set: { kategori: isi.kategori, klasifikasi: isi.klasifikasi, alasanManual: isi.alasanManual },
      });
  }
  await tx.execute(sql.raw(pernyataanHitungUlang()));
  const sesudah = await tx
    .select({ kode: produk.kode, klasifikasi: produk.klasifikasi, alasanManual: produk.alasanManual })
    .from(produk)
    .where(
      inArray(
        produk.kode,
        daftar.map((p) => p.kode),
      ),
    );
  return new Map(sesudah.map((p) => [p.kode, { klasifikasi: p.klasifikasi, alasanManual: p.alasanManual }]));
}

describe("migrasi 0033: klasifikasi produk dihitung ulang dengan aturan produk display (ADR-0012)", () => {
  it("DP120E-24H (DISPLAY PRIA, otomatis menurut aturan lama) → manual/display; DP120E-CHA-T tetap display-tester; KTP-POL tetap kertas-tester", async () => {
    const hasil = await dalamTransaksiDibatalkan((tx) =>
      migrasikan(tx, [
        { kode: "DP120E-24H", kategori: "DISPLAY PRIA", klasifikasi: "otomatis", alasanManual: null },
        { kode: "DD-GS15-B", kategori: "DISPLAY WANITA", klasifikasi: "otomatis", alasanManual: null },
        { kode: "DP120E-ONL-R", kategori: "DISPLAY PRIA", klasifikasi: "otomatis", alasanManual: null },
        { kode: "DP120E-CHA-T", kategori: "DISPLAY PRIA", klasifikasi: "manual", alasanManual: "display-tester" },
        { kode: "KTP-POL", kategori: "KTP", klasifikasi: "manual", alasanManual: "kertas-tester" },
        { kode: "PW110P-GOR", kategori: "PARFUM WANITA", klasifikasi: "otomatis", alasanManual: null },
      ]),
    );

    expect(Object.fromEntries(hasil)).toEqual({
      "DP120E-24H": { klasifikasi: "manual", alasanManual: "display" },
      "DD-GS15-B": { klasifikasi: "manual", alasanManual: "display" },
      "DP120E-ONL-R": { klasifikasi: "manual", alasanManual: "display" },
      "DP120E-CHA-T": { klasifikasi: "manual", alasanManual: "display-tester" },
      "KTP-POL": { klasifikasi: "manual", alasanManual: "kertas-tester" },
      "PW110P-GOR": { klasifikasi: "otomatis", alasanManual: null },
    });
  });

  it("setiap kasus golden klasifikasi-produk-2026-11-04: hasil migrasi sama dengan fixture (normalisasi kategori display, KTP/KTL persis)", async () => {
    // Kode golden boleh berulang dengan kategori berbeda: kode tersimpan diberi awalan unik, akhiran -T tetap.
    const daftar = golden.kasus.map((k) => ({ ...k, kodeTersimpan: `${kodeProdukUji("X")}-${k.kode}` }));
    const hasil = await dalamTransaksiDibatalkan((tx) =>
      migrasikan(
        tx,
        daftar.map((k) => ({ kode: k.kodeTersimpan, kategori: k.kategori, klasifikasi: "otomatis", alasanManual: null })),
      ),
    );

    for (const k of daftar) {
      expect(hasil.get(k.kodeTersimpan), `${k.kode} (${k.kategori})`).toEqual({
        klasifikasi: k.klasifikasi,
        alasanManual: k.alasan ?? null,
      });
    }
  });

  it("kategori dengan tab, spasi tak terputus, atau huruf campuran: hasil migrasi sama dengan klasifikasiProduk", async () => {
    const kategori = ["display\tpria", "DISPLAY WANITA", "　Display  Wanita\n", "Ktl", "KTL ", "DISPLAY-PRIA", "DISPLAYPRIA"];
    const daftar = kategori.map((k) => ({ kode: kodeProdukUji("X"), kategori: k }));
    const hasil = await dalamTransaksiDibatalkan((tx) =>
      migrasikan(
        tx,
        daftar.map((p) => ({ ...p, klasifikasi: "otomatis", alasanManual: null })),
      ),
    );

    for (const p of daftar) {
      const harapan = klasifikasiProduk(p.kode, p.kategori);
      expect(hasil.get(p.kode), JSON.stringify(p.kategori)).toEqual({
        klasifikasi: harapan.klasifikasi,
        alasanManual: harapan.klasifikasi === "manual" ? harapan.alasan : null,
      });
    }
  });

  it("hanya tabel produk yang diubah: draft dan rencana final tidak disentuh", () => {
    for (const p of pernyataanMigrasi(BERKAS_MIGRASI)) {
      expect(p).toMatch(/^(ALTER TABLE|UPDATE) "produk" /);
    }
  });
});
