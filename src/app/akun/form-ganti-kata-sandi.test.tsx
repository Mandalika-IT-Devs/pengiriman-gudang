// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HasilSimpan } from "@/components/keadaan-simpan";

// T138: form Ganti kata sandi di Akun saya. Tombol mata per isian (DESIGN §6 ▶ Keputusan 2026-10-20) dan keadaan simpan
// (CODING_STANDARDS "Penyimpanan dan status").

const aksi = vi.hoisted(() => ({ gantiKataSandi: vi.fn<(input: unknown) => Promise<HasilSimpan>>() }));
vi.mock("./aksi", () => aksi);

import { FormGantiKataSandi } from "./form-ganti-kata-sandi";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let wadah: HTMLElement;
let akar: Root;

beforeEach(() => {
  aksi.gantiKataSandi.mockReset();
  wadah = document.createElement("div");
  document.body.append(wadah);
  akar = createRoot(wadah);
  act(() => akar.render(<FormGantiKataSandi bukanAdmin />));
});

afterEach(() => {
  act(() => akar.unmount());
  wadah.remove();
});

const LABEL = ["Kata sandi saat ini", "Kata sandi baru", "Ulangi kata sandi baru"] as const;

function isian(label: (typeof LABEL)[number]) {
  const elemenLabel = [...wadah.querySelectorAll("label")].find((l) => l.textContent === label);
  const elemen = elemenLabel ? wadah.querySelector<HTMLInputElement>(`[id="${elemenLabel.htmlFor}"]`) : null;
  if (!elemen) throw new Error(`Isian "${label}" tidak ada.`);
  return elemen;
}

const tombolMata = (label: (typeof LABEL)[number]) => wadah.querySelector<HTMLButtonElement>(`button[aria-controls="${isian(label).id}"]`)!;

/** Mengetik seperti pengguna: nilai diset lewat setter bawaan agar React menerima event input. */
function ketik(elemen: HTMLInputElement, nilai: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(elemen, nilai);
    elemen.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function isiSemua() {
  ketik(isian("Kata sandi saat ini"), "sandi-lama-123");
  ketik(isian("Kata sandi baru"), "sandi-baru-456");
  ketik(isian("Ulangi kata sandi baru"), "sandi-baru-456");
}

async function kirim() {
  await act(async () => {
    wadah.querySelector("form")!.requestSubmit(wadah.querySelector<HTMLButtonElement>('button[type="submit"]'));
  });
}

const pesanStatus = () => wadah.querySelector("[data-keadaan]");

describe("tombol mata di ketiga isian", () => {
  it("ketiga isian awalnya tersembunyi, masing-masing dengan tombol mata sendiri", () => {
    for (const label of LABEL) {
      expect(isian(label).type).toBe("password");
      expect(tombolMata(label).getAttribute("aria-label")).toBe("Tampilkan kata sandi");
      expect(tombolMata(label).getAttribute("aria-pressed")).toBe("false");
    }
  });

  it.each(LABEL)("%s: tombol menampilkan lalu menyembunyikan isinya tanpa mengirim form", (label) => {
    isiSemua();
    act(() => tombolMata(label).click());
    expect(isian(label).type).toBe("text");
    expect(tombolMata(label).getAttribute("aria-pressed")).toBe("true");
    for (const lain of LABEL.filter((l) => l !== label)) expect(isian(lain).type).toBe("password");

    act(() => tombolMata(label).click());
    expect(isian(label).type).toBe("password");
    expect(aksi.gantiKataSandi).not.toHaveBeenCalled();
  });
});

describe("menyimpan", () => {
  it("belum disimpan saat diketik; berhasil → pesan berhasil dan semua isian dikosongkan", async () => {
    isiSemua();
    expect(pesanStatus()?.getAttribute("data-keadaan")).toBe("belumDisimpan");
    aksi.gantiKataSandi.mockResolvedValue({ keadaan: "berhasil" });

    await kirim();

    expect(aksi.gantiKataSandi).toHaveBeenCalledWith({
      sandiSaatIni: "sandi-lama-123",
      sandiBaru: "sandi-baru-456",
      ulangiSandiBaru: "sandi-baru-456",
    });
    expect(pesanStatus()?.getAttribute("data-keadaan")).toBe("berhasil");
    expect(pesanStatus()?.textContent).toBe("Kata sandi berhasil diganti. Perangkat lain sudah dikeluarkan.");
    for (const label of LABEL) expect(isian(label).value).toBe("");
  });

  it("gagal → pesan dari server; isian tetap", async () => {
    isiSemua();
    aksi.gantiKataSandi.mockResolvedValue({ keadaan: "gagal", pesan: "Kata sandi saat ini salah." });

    await kirim();

    expect(pesanStatus()?.getAttribute("data-keadaan")).toBe("gagal");
    expect(pesanStatus()?.getAttribute("role")).toBe("alert");
    expect(pesanStatus()?.textContent).toContain("Kata sandi saat ini salah.");
    expect(isian("Kata sandi saat ini").value).toBe("sandi-lama-123");
    expect(isian("Kata sandi baru").value).toBe("sandi-baru-456");
  });

  it("tersimpan tetapi gagal memuat ulang → keadaan kelima; isian dikosongkan", async () => {
    isiSemua();
    aksi.gantiKataSandi.mockResolvedValue({ keadaan: "tersimpanGagalMuatUlang" });

    await kirim();

    expect(pesanStatus()?.getAttribute("data-keadaan")).toBe("tersimpanGagalMuatUlang");
    for (const label of LABEL) expect(isian(label).value).toBe("");
  });

  it("server tidak menjawab → hasil belum pasti, tidak diulang otomatis", async () => {
    isiSemua();
    aksi.gantiKataSandi.mockRejectedValue(new Error("jaringan putus"));

    await kirim();

    expect(aksi.gantiKataSandi).toHaveBeenCalledTimes(1);
    expect(pesanStatus()?.getAttribute("data-keadaan")).toBe("gagal");
    expect(pesanStatus()?.textContent).toContain("Hasil belum pasti");
    expect(pesanStatus()?.textContent).toContain("apakah kata sandi baru sudah berlaku");
  });
});

describe("keterangan admin dapat melihat", () => {
  const KETERANGAN = "Admin dapat melihat kata sandi akun ini. Jangan memakai kata sandi yang juga Anda pakai di tempat lain.";

  it("tampil untuk akun bukan admin, tidak untuk akun admin", () => {
    expect(wadah.textContent).toContain(KETERANGAN);
    act(() => akar.render(<FormGantiKataSandi bukanAdmin={false} />));
    expect(wadah.textContent).not.toContain(KETERANGAN);
  });
});
