// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const tiruan = vi.hoisted(() => ({ ubahDikirimPekanIni: vi.fn(), refresh: vi.fn() }));
vi.mock("./aksi-dikirim-pekan-ini", () => ({ ubahDikirimPekanIni: tiruan.ubahDikirimPekanIni }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: tiruan.refresh, push: () => {} }) }));

import { lepasTerpasang, pasangUntukUji } from "@/components/ui/uji-bantu-dialog-konfirmasi";
import { parseTanggalBisnis } from "@/domain/kalender";

import { FormDikirimPekanIni } from "./form-dikirim-pekan-ini";

// T134 (PRD A5 ▶ Revisi 2026-10-19; A7 keadaan simpan): pilihan Dikirim / Tidak dikirim pekan ini disimpan lewat tombol
// "Simpan pilihan" dengan status belum disimpan, berhasil, dan gagal di dekat pilihannya.

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  lepasTerpasang();
  vi.clearAllMocks();
});

function buka(dikirim: boolean) {
  return pasangUntukUji(
    <FormDikirimPekanIni idGudang={3} tanggalKirim={parseTanggalBisnis("2026-10-28")} tokoId={7} namaToko="BXC" dikirim={dikirim} />,
  );
}

const pilihan = (wadah: HTMLElement, kode: "ya" | "tidak") => wadah.querySelector<HTMLInputElement>(`input[data-pilihan-dikirim="${kode}"]`)!;
const tombol = (wadah: HTMLElement) => wadah.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const status = (wadah: HTMLElement) => wadah.querySelector("[data-keadaan]")?.getAttribute("data-keadaan") ?? null;

describe("FormDikirimPekanIni", () => {
  it("nilai saat ini terpilih; Simpan pilihan baru aktif setelah pilihan diubah (belum disimpan), lalu berhasil", async () => {
    tiruan.ubahDikirimPekanIni.mockResolvedValue({ keadaan: "berhasil" });
    const wadah = buka(false);
    expect(pilihan(wadah, "tidak").checked).toBe(true);
    expect(pilihan(wadah, "ya").checked).toBe(false);
    expect(tombol(wadah).disabled).toBe(true);
    expect(status(wadah)).toBeNull();

    act(() => pilihan(wadah, "ya").click());
    expect(status(wadah)).toBe("belumDisimpan");
    expect(tombol(wadah).disabled).toBe(false);

    await act(async () => tombol(wadah).click());
    expect(tiruan.ubahDikirimPekanIni).toHaveBeenCalledWith({ idGudang: 3, tanggalKirim: "2026-10-28", tokoId: 7, dikirim: true });
    expect(status(wadah)).toBe("berhasil");
    expect(tiruan.refresh).toHaveBeenCalled();
  });

  it("ditolak server: status gagal beserta pesannya, tanpa memuat ulang", async () => {
    tiruan.ubahDikirimPekanIni.mockResolvedValue({ keadaan: "gagal", pesan: "Toko ini sudah punya rencana final untuk tanggal ini." });
    const wadah = buka(true);
    act(() => pilihan(wadah, "tidak").click());
    await act(async () => tombol(wadah).click());
    expect(status(wadah)).toBe("gagal");
    expect(wadah.textContent).toContain("Toko ini sudah punya rencana final untuk tanggal ini.");
    expect(tiruan.refresh).not.toHaveBeenCalled();
  });
});
