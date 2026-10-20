// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IsianKataSandi } from "./isian-kata-sandi";

// DESIGN §6 ▶ Keputusan 2026-10-20 (T137): tombol mata pada isian kata sandi.

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let wadah: HTMLElement;
let akar: Root;

afterEach(() => {
  act(() => akar.unmount());
  wadah.remove();
});

function pasang(kirim: () => void) {
  wadah = document.createElement("div");
  document.body.append(wadah);
  akar = createRoot(wadah);
  act(() =>
    akar.render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          kirim();
        }}
      >
        <label htmlFor="sandi-a">Kata sandi baru</label>
        <IsianKataSandi id="sandi-a" defaultValue="rahasia-a" />
        <label htmlFor="sandi-b">Ulangi kata sandi baru</label>
        <IsianKataSandi id="sandi-b" defaultValue="rahasia-b" />
      </form>,
    ),
  );
}

const isian = (id: string) => wadah.querySelector<HTMLInputElement>(`#${id}`)!;
const tombolMata = () => [...wadah.querySelectorAll<HTMLButtonElement>("button")];
const ikon = (tombol: HTMLButtonElement) => tombol.querySelector("svg")?.getAttribute("class") ?? "";

describe("isian kata sandi dengan tombol mata", () => {
  it("awalnya tersembunyi; setiap isian punya tombol bernama 'Tampilkan kata sandi' berukuran sentuh 44 px", () => {
    pasang(vi.fn());
    expect(isian("sandi-a").type).toBe("password");
    expect(isian("sandi-b").type).toBe("password");
    const [a, b] = tombolMata();
    expect(tombolMata()).toHaveLength(2);
    for (const tombol of [a!, b!]) {
      expect(tombol.getAttribute("aria-label")).toBe("Tampilkan kata sandi");
      expect(tombol.getAttribute("aria-pressed")).toBe("false");
      expect(tombol.type).toBe("button");
      expect(tombol.className.split(" ")).toContain("size-11");
      expect(ikon(tombol)).toContain("lucide-eye");
      expect(ikon(tombol)).not.toContain("lucide-eye-off");
    }
    expect(a!.getAttribute("aria-controls")).toBe("sandi-a");
  });

  it("menekan tombol menampilkan lalu menyembunyikan isi, mengganti ikon dan aria-pressed, tanpa mengirim form", () => {
    const kirim = vi.fn();
    pasang(kirim);
    const [a] = tombolMata();

    act(() => a!.click());
    expect(isian("sandi-a").type).toBe("text");
    expect(isian("sandi-a").value).toBe("rahasia-a");
    expect(a!.getAttribute("aria-pressed")).toBe("true");
    expect(a!.getAttribute("aria-label")).toBe("Tampilkan kata sandi");
    expect(ikon(a!)).toContain("lucide-eye-off");
    // Isian lain tidak ikut berubah.
    expect(isian("sandi-b").type).toBe("password");

    act(() => a!.click());
    expect(isian("sandi-a").type).toBe("password");
    expect(a!.getAttribute("aria-pressed")).toBe("false");
    expect(ikon(a!)).not.toContain("lucide-eye-off");

    expect(kirim).not.toHaveBeenCalled();
  });
});
