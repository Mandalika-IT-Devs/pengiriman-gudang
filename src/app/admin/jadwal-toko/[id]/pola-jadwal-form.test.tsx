// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const aksi = vi.hoisted(() => ({
  aturJadwalTetapToko: vi.fn(async () => ({ keadaan: "berhasil" as const })),
  nonaktifkanJadwalTetapToko: vi.fn(),
  salinJadwalTetap: vi.fn(),
}));
vi.mock("../aksi", () => aksi);

import { isianTerkirim } from "@/app/pengiriman-gudang/[id]/bidang-jadwal";

import { FormJadwalTetap } from "./form-jadwal-tetap";
import { FormSalinJadwal } from "./form-salin-jadwal";

// T92: pola 1× sebulan bisa dipilih di form jadwal (PRD A5 ▶ Keputusan 2026-10-12, UAT ketiga). Form jadwal operator
// dihapus (T113); jadwal tetap diatur admin di halaman Jadwal toko (T112), jadi pilihan pola dan hari diuji di form admin.

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let terpasang: { wadah: HTMLElement; akar: Root } | null = null;

function tampilkan(isi: ReactNode) {
  const wadah = document.createElement("div");
  document.body.append(wadah);
  const akar = createRoot(wadah);
  act(() => akar.render(isi));
  terpasang = { wadah, akar };
  return wadah;
}

afterEach(() => {
  if (terpasang !== null) {
    const { wadah, akar } = terpasang;
    act(() => akar.unmount());
    wadah.remove();
    terpasang = null;
  }
});

/** Pilihan pola (nilai dan teks) dari select bawaan Radix yang mendampingi kontrol Pola di dalam form. */
function pilihanPola(wadah: HTMLElement) {
  const select = [...wadah.querySelectorAll("select")].find((s) => s.querySelector('option[value="mingguan"]') !== null);
  if (select === undefined) throw new Error("Kontrol Pola tidak ada.");
  return [...select.options].map((o) => [o.value, o.textContent]);
}

const SEMUA_POLA = [
  ["mingguan", "Mingguan"],
  ["2x-seminggu", "2× seminggu"],
  ["3x-seminggu", "3× seminggu"],
  ["dua-mingguan", "Dua mingguan"],
  ["1x-sebulan", "1× sebulan"],
];

const toko = { id: 1, nama: "TOKO UJI", jadwal: null };

describe("pilihan pola 1× sebulan di form jadwal tetap", () => {
  it("form jadwal tetap admin menampilkan semua pola", () => {
    expect(pilihanPola(tampilkan(<FormJadwalTetap idGudang={1} toko={toko} />))).toEqual(SEMUA_POLA);
  });
});

// T106: hari Minggu bisa dipilih sebagai hari kirim (PRD A5 ▶ Revisi 2026-10-13, pemilik).
const TUJUH_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

/** Nilai checkbox hari kirim, dalam urutan tampil. */
function pilihanHari(wadah: HTMLElement) {
  return [...wadah.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="hariKirim"]')].map((c) => c.value);
}

describe("hari kirim Senin–Minggu di form jadwal tetap", () => {
  it("form jadwal tetap admin menampilkan tujuh hari berurutan Senin–Minggu", () => {
    expect(pilihanHari(tampilkan(<FormJadwalTetap idGudang={1} toko={toko} />))).toEqual(TUJUH_HARI);
  });

  it("isianTerkirim mempertahankan Minggu dan mengurutkan hari Senin–Minggu", () => {
    expect(
      isianTerkirim({
        pola: "2x-seminggu",
        hariKirim: [
          { hari: "Minggu", persiapan: "H-1" },
          { hari: "Kamis", persiapan: "H" },
        ],
      }),
    ).toEqual({
      pola: "2x-seminggu",
      hariKirim: [
        { hari: "Kamis", persiapan: "H" },
        { hari: "Minggu", persiapan: "H-1" },
      ],
    });
  });
});

// T135 — PRD A5 ▶ Revisi 2026-10-19 (Tampilan jadwal): isian "Tanggal jangkar" dihapus dari form jadwal tetap dan form Salin
// jadwal. Saat pola Dua mingguan dipilih, form menampilkan keterangan pola itu.
const KETERANGAN_DUA_MINGGUAN = "Toko dikirim pada hari kirim ini. Operator memilih pekannya di draft, biasanya setiap 2 minggu.";

/** Memilih pola lewat select bawaan Radix yang mendampingi kontrol Pola (sama seperti isian otomatis peramban). */
function pilihPola(wadah: HTMLElement, pola: string) {
  const select = [...wadah.querySelectorAll("select")].find((s) => s.querySelector('option[value="mingguan"]') !== null);
  if (select === undefined) throw new Error("Kontrol Pola tidak ada.");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, pola);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const bxc = { id: 7, nama: "BXC", jadwal: { pola: "dua-mingguan" as const, hariKirim: [{ hari: "Rabu" as const, persiapan: "H-1" as const }] } };

describe("form jadwal tanpa tanggal jangkar (PRD A5 ▶ Revisi 2026-10-19)", () => {
  it("form jadwal tetap BXC dua mingguan Rabu (H−1): tanpa isian tanggal jangkar, dengan keterangan pola dua mingguan", () => {
    const wadah = tampilkan(<FormJadwalTetap idGudang={1} toko={bxc} />);
    expect(wadah.querySelector('input[type="date"]')).toBeNull();
    expect(wadah.textContent).not.toMatch(/jangkar/i);
    expect(wadah.textContent).toContain(KETERANGAN_DUA_MINGGUAN);
  });

  it("form jadwal tetap: keterangan hanya tampil saat pola Dua mingguan dipilih", () => {
    const wadah = tampilkan(<FormJadwalTetap idGudang={1} toko={toko} />);
    expect(wadah.textContent).not.toContain(KETERANGAN_DUA_MINGGUAN);
    pilihPola(wadah, "dua-mingguan");
    expect(wadah.textContent).toContain(KETERANGAN_DUA_MINGGUAN);
    expect(wadah.querySelector('input[type="date"]')).toBeNull();
    pilihPola(wadah, "mingguan");
    expect(wadah.textContent).not.toContain(KETERANGAN_DUA_MINGGUAN);
  });

  it("form Salin jadwal: memilih Dua mingguan menampilkan keterangan, tanpa isian tanggal jangkar", () => {
    const wadah = tampilkan(<FormSalinJadwal idGudang={1} daftarToko={[{ id: 7, nama: "BXC" }]} />);
    pilihPola(wadah, "dua-mingguan");
    expect(wadah.textContent).toContain(KETERANGAN_DUA_MINGGUAN);
    expect(wadah.querySelector('input[type="date"]')).toBeNull();
    expect(wadah.textContent).not.toMatch(/jangkar/i);
  });

  it("menyimpan jadwal dua mingguan Rabu (H−1) mengirim pola dan hari kirim saja, tanpa tanggal jangkar", async () => {
    const wadah = tampilkan(<FormJadwalTetap idGudang={1} toko={bxc} />);
    const form = wadah.querySelector("form");
    if (form === null) throw new Error("Form tidak ada.");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(aksi.aturJadwalTetapToko).toHaveBeenCalledWith({
      idGudang: 1,
      idToko: 7,
      pola: "dua-mingguan",
      hariKirim: [{ hari: "Rabu", persiapan: "H-1" }],
    });
  });
});
