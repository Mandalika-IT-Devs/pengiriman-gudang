// Pembaca tabel unggahan kecil yang dibaca langsung di server action (tanpa storage): CSV berpemisah koma, titik koma,
// atau tab yang dikenali otomatis dari baris pertama (T139, PRD A6 ▶ Keputusan 2026-10-22; UTF-8, dengan atau tanpa
// BOM, akhir baris CRLF atau LF; nilai boleh diapit tanda kutip ganda) atau workbook `.xlsx` (sheet pertama) → baris
// sel mentah mulai baris 1 dan kolom A, supaya nomor baris sama dengan nomor baris file. Sel workbook dibaca sebagai
// nilai mentah (`cellDates: false`). Dipakai tabel alias (T82) dan file stok (T83). Jenis file ditentukan dari ekstensi
// nama file.

import * as XLSX from "xlsx";

import type { SelMentah } from "@/domain/ranking";

export type HasilBacaTabel = { ok: true; baris: SelMentah[][] } | { ok: false; pesan: string };

const PESAN_FORMAT_FILE = "Format file harus CSV atau .xlsx.";

function nilaiMentah(sel: XLSX.CellObject | undefined): SelMentah {
  if (!sel || sel.t === "z" || sel.v === undefined || sel.v === null) return null;
  if (sel.t === "e") return sel.w ?? "#ERROR";
  if (typeof sel.v === "number" || typeof sel.v === "string" || typeof sel.v === "boolean") return sel.v;
  return String(sel.v);
}

function barisWorkbook(isi: Uint8Array): SelMentah[][] {
  const wb = XLSX.read(isi, { type: "buffer", cellDates: false });
  const sheet = wb.SheetNames.length > 0 ? wb.Sheets[wb.SheetNames[0]] : undefined;
  if (!sheet?.["!ref"]) return [];
  const rentang = XLSX.utils.decode_range(sheet["!ref"]);
  const baris: SelMentah[][] = [];
  for (let r = 0; r <= rentang.e.r; r++) {
    const sel: SelMentah[] = [];
    for (let c = 0; c <= rentang.e.c; c++) {
      sel.push(nilaiMentah(sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined));
    }
    baris.push(sel);
  }
  return baris;
}

/** Calon pemisah CSV, berurutan menurut prioritas saat jumlahnya di baris pertama seri. */
const CALON_PEMISAH = [";", ",", "\t"] as const;

type Pemisah = (typeof CALON_PEMISAH)[number];

/**
 * Satu baris CSV dengan `pemisah`, atau satu sel saja jika `pemisah` = `null`. Nilai boleh diapit tanda kutip ganda dan
 * tetap satu sel walaupun memuat pemisah (`""` = satu tanda kutip).
 */
function pecahBarisCsv(baris: string, pemisah: Pemisah | null): string[] {
  const sel: string[] = [];
  let nilai = "";
  let dalamKutip = false;
  for (let i = 0; i < baris.length; i++) {
    const huruf = baris[i];
    if (dalamKutip) {
      if (huruf === '"' && baris[i + 1] === '"') {
        nilai += '"';
        i++;
      } else if (huruf === '"') {
        dalamKutip = false;
      } else {
        nilai += huruf;
      }
    } else if (huruf === '"') {
      dalamKutip = true;
    } else if (huruf === pemisah) {
      sel.push(nilai);
      nilai = "";
    } else {
      nilai += huruf;
    }
  }
  sel.push(nilai);
  return sel;
}

/**
 * Pemisah file = calon yang paling sering muncul di luar tanda kutip ganda di baris pertama (jumlah sel − 1); jika
 * seri, calon yang lebih dulu di `CALON_PEMISAH`. Tidak ada satu pun → `null`: setiap baris dibaca sebagai satu kolom.
 */
function pilihPemisah(barisPertama: string): Pemisah | null {
  let terpilih: Pemisah | null = null;
  let jumlahTerbanyak = 0;
  for (const calon of CALON_PEMISAH) {
    const jumlah = pecahBarisCsv(barisPertama, calon).length - 1;
    if (jumlah > jumlahTerbanyak) {
      terpilih = calon;
      jumlahTerbanyak = jumlah;
    }
  }
  return terpilih;
}

function barisCsv(isi: Uint8Array): string[][] {
  const teks = new TextDecoder("utf-8").decode(isi).replace(/^﻿/, "");
  const semuaBaris = teks.split(/\r?\n/);
  const pemisah = pilihPemisah(semuaBaris[0]);
  return semuaBaris.map((baris) => pecahBarisCsv(baris, pemisah));
}

export function bacaTabel(namaFile: string, isi: Uint8Array): HasilBacaTabel {
  const nama = namaFile.toLowerCase();
  if (nama.endsWith(".xlsx")) return { ok: true, baris: barisWorkbook(isi) };
  if (nama.endsWith(".csv")) return { ok: true, baris: barisCsv(isi) };
  return { ok: false, pesan: PESAN_FORMAT_FILE };
}
