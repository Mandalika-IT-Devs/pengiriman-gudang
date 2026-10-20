// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tiruan = vi.hoisted(() => ({ tampilkanKataSandi: vi.fn(), aturUlangKataSandi: vi.fn() }));
vi.mock("./aksi", () => ({
  tampilkanKataSandi: tiruan.tampilkanKataSandi,
  aturUlangKataSandi: tiruan.aturUlangKataSandi,
  nonaktifkanPengguna: vi.fn(),
  aktifkanKembaliPengguna: vi.fn(),
  ubahPeran: vi.fn(),
}));

import { lepasTerpasang, pasangUntukUji } from "@/components/ui/uji-bantu-dialog-konfirmasi";

import { BarisPengguna, type DataPengguna } from "./baris-pengguna";

// T137 (PRD A3 ▶ Keputusan 2026-10-20): kolom Kata sandi dan dialog Atur ulang kata sandi di baris pengguna.

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PENGGUNA: DataPengguna = {
  id: "u-1",
  nama: "Sari",
  email: "sari@contoh.id",
  peran: "viewer",
  peranTampil: "viewer",
  akunSendiri: false,
  nonaktif: false,
  kataSandi: { keadaan: "tersembunyi", diubah: { pada: new Date("2026-10-21T03:00:00Z"), oleh: "Admin Utama" } },
};

function pasang(pengguna: Partial<DataPengguna> = {}) {
  return pasangUntukUji(
    <table>
      <tbody>
        <BarisPengguna pengguna={{ ...PENGGUNA, ...pengguna }} />
      </tbody>
    </table>,
  );
}

function tombol(akar: ParentNode, nama: string): HTMLButtonElement {
  const hasil = [...akar.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === nama || b.getAttribute("aria-label") === nama,
  );
  if (hasil === undefined) throw new Error(`Tombol "${nama}" tidak ada.`);
  return hasil;
}

async function tekan(elemen: HTMLElement) {
  await act(async () => {
    elemen.click();
  });
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

function ketik(isian: HTMLInputElement, nilai: string) {
  const setel = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setel.call(isian, nilai);
    isian.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  tiruan.tampilkanKataSandi.mockReset();
  tiruan.aturUlangKataSandi.mockReset();
});

afterEach(() => {
  lepasTerpasang();
});

describe("kolom Kata sandi", () => {
  it("tersembunyi sampai Tampilkan ditekan; Sembunyikan menyembunyikannya lagi", async () => {
    tiruan.tampilkanKataSandi.mockResolvedValue({ keadaan: "tersedia", sandi: "Sandi-Sari-2026" });
    const wadah = pasang();
    expect(wadah.textContent).toContain("••••••••");
    expect(wadah.textContent).not.toContain("Sandi-Sari-2026");
    expect(wadah.textContent).toContain("Diubah Rabu, 21-10-2026 oleh Admin Utama");
    expect(tiruan.tampilkanKataSandi).not.toHaveBeenCalled();

    await tekan(tombol(wadah, "Tampilkan kata sandi Sari"));
    expect(tiruan.tampilkanKataSandi).toHaveBeenCalledWith({ idPengguna: "u-1" });
    expect(wadah.querySelector('[data-kata-sandi="terlihat"]')?.textContent).toBe("Sandi-Sari-2026");
    expect(wadah.textContent).not.toContain("••••••••");

    await tekan(tombol(wadah, "Sembunyikan kata sandi Sari"));
    expect(wadah.textContent).not.toContain("Sandi-Sari-2026");
    expect(wadah.textContent).toContain("••••••••");
  });

  it("server menjawab belum tersedia → Belum tersedia beserta keterangannya", async () => {
    tiruan.tampilkanKataSandi.mockResolvedValue({ keadaan: "belumTersedia" });
    const wadah = pasang();
    await tekan(tombol(wadah, "Tampilkan"));
    expect(wadah.querySelector('[data-kata-sandi="belumTersedia"]')?.textContent).toBe("Belum tersedia");
    expect(wadah.textContent).toContain("Tersedia setelah pengguna mengganti kata sandinya atau admin mengatur ulang.");
  });

  it("server tidak menjawab → pesan gagal, kata sandi tetap tersembunyi", async () => {
    tiruan.tampilkanKataSandi.mockRejectedValue(new Error("jaringan putus"));
    const wadah = pasang();
    await tekan(tombol(wadah, "Tampilkan"));
    expect(wadah.querySelector('[data-keadaan="gagal"]')?.textContent).toContain("Kata sandi tidak bisa ditampilkan");
    expect(wadah.textContent).toContain("••••••••");
  });

  it("akun admin: — tanpa tombol Tampilkan; tanpa catatan: keterangan —", () => {
    const wadah = pasang({ peran: "admin", peranTampil: "admin", kataSandi: { keadaan: "admin", diubah: null } });
    expect(wadah.querySelector('[data-kata-sandi="admin"]')?.textContent).toBe("—");
    expect(wadah.querySelector("[data-kata-sandi-diubah]")?.textContent).toBe("—");
    expect(wadah.textContent).not.toContain("Tampilkan");
  });
});

describe("Atur ulang kata sandi", () => {
  it("tidak ada di baris akun sendiri", () => {
    const wadah = pasang({ akunSendiri: true });
    expect(wadah.textContent).not.toContain("Atur ulang kata sandi");
  });

  it("dialog berjudul nama akun, dua isian bertombol mata, keterangan keluar dari semua perangkat; Simpan menjalankan aksinya", async () => {
    tiruan.aturUlangKataSandi.mockResolvedValue({ keadaan: "berhasil" });
    const wadah = pasang();
    await tekan(tombol(wadah, "Atur ulang kata sandi Sari"));

    const isi = dialog();
    expect(isi).not.toBeNull();
    expect(isi!.querySelector("h2")?.textContent).toBe("Atur ulang kata sandi Sari");
    expect(isi!.textContent).toContain("Sari akan keluar dari semua perangkat dan harus masuk dengan kata sandi baru.");
    const label = [...isi!.querySelectorAll("label")].map((l) => l.textContent);
    expect(label).toEqual(["Kata sandi baru", "Ulangi kata sandi baru"]);
    const [baru, ulangi] = [...isi!.querySelectorAll<HTMLInputElement>("input")];
    expect(baru!.type).toBe("password");
    expect(ulangi!.type).toBe("password");
    const mata = [...isi!.querySelectorAll<HTMLButtonElement>("[data-tombol-mata]")];
    expect(mata.map((b) => b.getAttribute("aria-controls"))).toEqual([baru!.id, ulangi!.id]);

    // Tombol mata tidak mengirim form.
    await tekan(mata[1]!);
    expect(ulangi!.type).toBe("text");
    expect(mata[1]!.getAttribute("aria-pressed")).toBe("true");
    expect(tiruan.aturUlangKataSandi).not.toHaveBeenCalled();

    ketik(baru!, "Sandi-Baru-77");
    ketik(ulangi!, "Sandi-Baru-77");
    expect(isi!.querySelector('[data-keadaan="belumDisimpan"]')).not.toBeNull();
    await tekan(tombol(isi!, "Simpan kata sandi"));
    expect(tiruan.aturUlangKataSandi).toHaveBeenCalledWith({
      idPengguna: "u-1",
      sandiBaru: "Sandi-Baru-77",
      ulangiSandiBaru: "Sandi-Baru-77",
    });
    expect(dialog()?.querySelector('[data-keadaan="berhasil"]')).not.toBeNull();
    expect(baru!.value).toBe("");
    expect(ulangi!.value).toBe("");
  });

  it("pesan gagal dari server tampil di dialog", async () => {
    tiruan.aturUlangKataSandi.mockResolvedValue({ keadaan: "gagal", pesan: "Ulangan kata sandi baru tidak sama." });
    const wadah = pasang();
    await tekan(tombol(wadah, "Atur ulang kata sandi Sari"));
    const [baru, ulangi] = [...dialog()!.querySelectorAll<HTMLInputElement>("input")];
    ketik(baru!, "Sandi-Baru-77");
    ketik(ulangi!, "Sandi-Baru-78");
    await tekan(tombol(dialog()!, "Simpan kata sandi"));
    expect(dialog()?.querySelector('[data-keadaan="gagal"]')?.textContent).toContain("Ulangan kata sandi baru tidak sama.");
  });
});
