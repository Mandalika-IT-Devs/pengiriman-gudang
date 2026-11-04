// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const aksi = vi.hoisted(() => ({
  aturJadwalTetapToko: vi.fn<(input: unknown) => Promise<{ keadaan: "berhasil" }>>(async () => ({ keadaan: "berhasil" })),
  nonaktifkanJadwalTetapToko: vi.fn(),
  salinJadwalTetap: vi.fn(),
}));
vi.mock("../aksi", () => aksi);

import { FormJadwalTetap } from "./form-jadwal-tetap";
import { RiwayatJadwalTetap } from "./riwayat-jadwal-tetap";
import { TabelJadwalTetap, type TokoJadwalTetap } from "./tabel-jadwal-tetap";

// T149 — PRD A5 ▶ Keputusan 2026-11-04 (toko acuan: Pengaturan, Tampilan); UAT U9.9, U9.13. Form "Atur jadwal" punya isian
// "Toko acuan" di bawah checkbox "Tambah 3 hari cakupan", awalnya kosong, dengan keterangan yang selalu tampil. Pola toko
// dengan toko acuan ditulis "<pola> · toko acuan <B>".

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KETERANGAN =
  "Isi hanya untuk toko yang belum punya data penjualan. Varian dan rata-rata diambil dari toko acuan, sedangkan jadwal, stok, dan kategori hari tetap milik toko ini.";

/** Pilihan dari server (urut nama), termasuk toko yang sedang diatur; form menyaring toko itu sendiri. */
const PILIHAN = [
  { id: 3, nama: "DPM" },
  { id: 24, nama: "MKG" },
  { id: 13, nama: "SMB" },
  { id: 30, nama: "UJI BARU" },
];

const ujiBaru = { id: 30, nama: "UJI BARU", jadwal: null };
const mingguanSelasa = {
  pola: "mingguan" as const,
  hariKirim: [{ hari: "Selasa" as const, persiapan: "H-1" as const }],
  tambah3HariCakupan: false,
};

let terpasang: { wadah: HTMLElement; akar: Root } | null = null;

function tampilkan(isi: ReactNode) {
  const wadah = document.createElement("div");
  document.body.append(wadah);
  const akar = createRoot(wadah);
  act(() => akar.render(isi));
  terpasang = { wadah, akar };
  return wadah;
}

beforeEach(() => {
  aksi.aturJadwalTetapToko.mockClear();
});

afterEach(() => {
  if (terpasang !== null) {
    const { wadah, akar } = terpasang;
    act(() => akar.unmount());
    wadah.remove();
    terpasang = null;
  }
});

/** Tombol pemicu select berlabel `label` (Radix: `aria-labelledby` menunjuk teks label). */
function kontrol(wadah: HTMLElement, label: string) {
  const tombol = [...wadah.querySelectorAll<HTMLElement>("button[aria-labelledby]")].find(
    (b) => document.getElementById(b.getAttribute("aria-labelledby") ?? "")?.textContent === label,
  );
  if (tombol === undefined) throw new Error(`Kontrol ${label} tidak ada.`);
  return tombol;
}

/** Select bawaan Radix yang mendampingi kontrol Toko acuan. */
function selectTokoAcuan(wadah: HTMLElement) {
  const select = [...wadah.querySelectorAll("select")].find((s) => s.querySelector('option[value="kosong"]') !== null);
  if (select === undefined) throw new Error("Kontrol Toko acuan tidak ada.");
  return select;
}

function pilihTokoAcuan(wadah: HTMLElement, nilai: string) {
  const select = selectTokoAcuan(wadah);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, nilai);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function simpan(wadah: HTMLElement) {
  await act(async () => {
    wadah.querySelector("form")?.requestSubmit();
  });
}

describe('isian "Toko acuan" di form jadwal tetap', () => {
  it('tepat di bawah checkbox "Tambah 3 hari cakupan", awalnya kosong, dengan keterangan PRD yang selalu tampil', () => {
    const wadah = tampilkan(<FormJadwalTetap idGudang={2} toko={ujiBaru} pilihanTokoAcuan={PILIHAN} />);
    const pemicu = kontrol(wadah, "Toko acuan");
    const urutan = [...wadah.querySelectorAll<HTMLElement>("form button, form input")];
    const centang = wadah.querySelector<HTMLInputElement>('input[name="tambah3HariCakupan"]');
    expect(urutan.indexOf(pemicu)).toBe(urutan.indexOf(centang as HTMLElement) + 1);
    expect(pemicu.textContent).toBe("Tanpa toko acuan");
    expect(selectTokoAcuan(wadah).value).toBe("kosong");
    expect(document.getElementById(pemicu.getAttribute("aria-describedby") ?? "")?.textContent).toBe(KETERANGAN);
  });

  it("pilihannya: Tanpa toko acuan, lalu toko dari server urut nama tanpa toko itu sendiri", () => {
    const wadah = tampilkan(<FormJadwalTetap idGudang={2} toko={ujiBaru} pilihanTokoAcuan={PILIHAN} />);
    expect([...selectTokoAcuan(wadah).options].map((o) => [o.value, o.textContent])).toEqual([
      ["kosong", "Tanpa toko acuan"],
      ["3", "DPM"],
      ["24", "MKG"],
      ["13", "SMB"],
    ]);
  });

  it("UAT U9.9: memilih MKG lalu Simpan jadwal mengirim toko acuannya", async () => {
    const wadah = tampilkan(<FormJadwalTetap idGudang={2} toko={{ ...ujiBaru, jadwal: mingguanSelasa }} pilihanTokoAcuan={PILIHAN} />);
    pilihTokoAcuan(wadah, "24");
    expect(kontrol(wadah, "Toko acuan").textContent).toBe("MKG");
    await simpan(wadah);
    expect(aksi.aturJadwalTetapToko).toHaveBeenLastCalledWith({
      idGudang: 2,
      idToko: 30,
      pola: "mingguan",
      hariKirim: [{ hari: "Selasa", persiapan: "H-1" }],
      tambah3HariCakupan: false,
      idTokoAcuan: 24,
    });
  });

  it("UAT U9.13: nilai awal mengikuti toko acuan jadwal aktif; mengosongkan lalu menyimpan mengirim tanpa toko acuan", async () => {
    const wadah = tampilkan(
      <FormJadwalTetap
        idGudang={2}
        toko={{ ...ujiBaru, jadwal: mingguanSelasa, tokoAcuan: { id: 24, nama: "MKG" } }}
        pilihanTokoAcuan={PILIHAN}
      />,
    );
    expect(kontrol(wadah, "Toko acuan").textContent).toBe("MKG");
    expect(selectTokoAcuan(wadah).value).toBe("24");

    await simpan(wadah);
    expect(aksi.aturJadwalTetapToko).toHaveBeenLastCalledWith(expect.objectContaining({ idTokoAcuan: 24 }));

    pilihTokoAcuan(wadah, "kosong");
    expect(kontrol(wadah, "Toko acuan").textContent).toBe("Tanpa toko acuan");
    await simpan(wadah);
    expect(aksi.aturJadwalTetapToko).toHaveBeenCalledTimes(2);
    expect(aksi.aturJadwalTetapToko.mock.lastCall?.[0]).toEqual({
      idGudang: 2,
      idToko: 30,
      pola: "mingguan",
      hariKirim: [{ hari: "Selasa", persiapan: "H-1" }],
      tambah3HariCakupan: false,
    });
    expect(aksi.aturJadwalTetapToko.mock.lastCall?.[0]).not.toHaveProperty("idTokoAcuan");
  });
});

const DIATUR = new Date("2026-11-04T03:05:00Z");
const DIGANTI = new Date("2026-11-05T02:10:00Z");

const tokoUjiBaru: TokoJadwalTetap = {
  id: 30,
  nama: "UJI BARU",
  aktif: true,
  jadwal: {
    versi: 52,
    pola: "mingguan",
    hariKirim: [{ hari: "Selasa", persiapanHari: 1 }],
    tambah3HariCakupan: false,
    diaturOleh: "Admin Uji",
    diaturPada: DIGANTI,
    tokoAcuan: { id: 24, nama: "MKG" },
  },
  riwayat: [
    {
      id: 52,
      pola: "mingguan",
      hariKirim: [{ hari: "Selasa", persiapanHari: 1 }],
      tambah3HariCakupan: false,
      tokoAcuan: { id: 24, nama: "MKG" },
      diaturOleh: "Admin Uji",
      diaturPada: DIGANTI,
      berakhir: null,
    },
    {
      id: 51,
      pola: "mingguan",
      hariKirim: [{ hari: "Selasa", persiapanHari: 1 }],
      tambah3HariCakupan: false,
      diaturOleh: "Admin Uji",
      diaturPada: DIATUR,
      berakhir: { jenis: "diganti", oleh: "Admin Uji", pada: DIGANTI },
    },
  ],
};
const tokoBertanda: TokoJadwalTetap = {
  id: 31,
  nama: "LMK",
  aktif: true,
  jadwal: { ...tokoUjiBaru.jadwal!, versi: 53, tambah3HariCakupan: true, tokoAcuan: { id: 13, nama: "SMB" } },
  riwayat: [],
};
const tokoBiasa: TokoJadwalTetap = {
  id: 24,
  nama: "MKG",
  aktif: true,
  jadwal: { versi: 54, pola: "mingguan", hariKirim: [{ hari: "Selasa", persiapanHari: 1 }], diaturOleh: "Admin Uji", diaturPada: DIATUR },
  riwayat: [],
};

/** Isi sel kolom Pola satu baris tabel. */
function selPola(wadah: HTMLElement, idToko: number) {
  const kolom = [...wadah.querySelectorAll("thead th")].findIndex((th) => th.textContent === "Pola");
  return wadah.querySelector(`tr[data-jadwal-toko="${idToko}"]`)?.querySelectorAll("td")[kolom]?.textContent;
}

describe("penanda Pola toko acuan", () => {
  it('tabel Jadwal toko: "Mingguan · toko acuan MKG", digabung "+3 hari cakupan" bila ada; tanpa toko acuan tetap "Mingguan"', () => {
    const wadah = tampilkan(
      <TabelJadwalTetap idGudang={2} daftarToko={[tokoUjiBaru, tokoBertanda, tokoBiasa]} pilihanTokoAcuan={PILIHAN} />,
    );
    expect(wadah.querySelectorAll("thead th")).toHaveLength(7);
    expect(selPola(wadah, 30)).toBe("Mingguan · toko acuan MKG");
    expect(selPola(wadah, 31)).toBe("Mingguan · +3 hari cakupan · toko acuan SMB");
    expect(selPola(wadah, 24)).toBe("Mingguan");
  });

  it('"Atur jadwal" membuka form dengan toko acuan jadwal aktif dan pilihan dari server', () => {
    const wadah = tampilkan(<TabelJadwalTetap idGudang={2} daftarToko={[tokoUjiBaru]} pilihanTokoAcuan={PILIHAN} />);
    act(() => wadah.querySelector<HTMLElement>('[data-atur-jadwal="30"]')?.click());
    const panel = document.querySelector<HTMLElement>('[data-slot="dialog-isi"]');
    if (panel === null) throw new Error("Panel tidak terbuka.");
    expect(kontrol(panel, "Toko acuan").textContent).toBe("MKG");
    expect([...selectTokoAcuan(panel).options].map((o) => o.textContent)).toEqual(["Tanpa toko acuan", "DPM", "MKG", "SMB"]);
  });

  it('riwayat jadwal tetap: "Mingguan · toko acuan MKG" untuk versi dengan toko acuan, "Mingguan" untuk versi tanpa', () => {
    const html = renderToStaticMarkup(<RiwayatJadwalTetap riwayat={tokoUjiBaru.riwayat} />);
    const pola = [...html.matchAll(/<li[^>]*data-riwayat-jadwal="(\d+)"[^>]*>.*?<span class="font-semibold">(.*?)<\/span>/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(pola).toEqual([
      ["52", "Mingguan · toko acuan MKG"],
      ["51", "Mingguan"],
    ]);
  });
});
