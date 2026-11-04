import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { punyaHakTindakan } from "@/server/gudang/akses";
import { daftarHakTindakan } from "@/server/gudang/hak-tindakan";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { buatGudangUji, hapusGudangUji, idGudangUji } from "@/server/gudang/uji-bantu";

const kepala = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));

import {
  AksesDitolakError,
  wajibAdmin,
  wajibAksesLihatGudang,
  wajibAksesPengirimanGudang,
  wajibHakTindakan,
  wajibMasuk,
} from "./kewenangan";

beforeEach(() => {
  kepala.cookie = "";
});

describe("wajibMasuk", () => {
  it("tanpa sesi: diarahkan ke halaman masuk", async () => {
    await expect(wajibMasuk()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT;replace;/masuk;") });
  });

  it("cookie sesi palsu: diarahkan ke halaman masuk", async () => {
    kepala.cookie = "better-auth.session_token=palsu.palsu";
    await expect(wajibMasuk()).rejects.toMatchObject({ digest: expect.stringContaining("/masuk") });
  });

  it("dengan sesi: mengembalikan pengguna dan perannya", async () => {
    const viewer = await kepalaPenggunaUji("viewer");
    kepala.cookie = viewer.cookie;
    await expect(wajibMasuk()).resolves.toMatchObject({ id: viewer.id, email: viewer.email, peran: "viewer" });
  });
});

describe("wajibAdmin", () => {
  it("tanpa sesi: diarahkan ke halaman masuk", async () => {
    await expect(wajibAdmin()).rejects.toMatchObject({ digest: expect.stringContaining("/masuk") });
  });

  it("viewer ditolak", async () => {
    kepala.cookie = (await kepalaPenggunaUji("viewer")).cookie;
    await expect(wajibAdmin()).rejects.toBeInstanceOf(AksesDitolakError);
  });

  it("admin diterima", async () => {
    const admin = await kepalaPenggunaUji("admin");
    kepala.cookie = admin.cookie;
    await expect(wajibAdmin()).resolves.toMatchObject({ id: admin.id, peran: "admin" });
  });
});

describe("wajibHakTindakan", () => {
  let gudangX: number;
  let gudangY: number;

  beforeAll(async () => {
    gudangX = await idGudangUji("Gudang Bali");
    gudangY = await idGudangUji("Gudang Bandung");
  });

  it("tanpa sesi: diarahkan ke halaman masuk", async () => {
    await expect(wajibHakTindakan(gudangX, "input-stok")).rejects.toMatchObject({
      digest: expect.stringContaining("/masuk"),
    });
  });

  it("admin tanpa penugasan lolos kelima hak tindakan di gudang aktif (PRD A3 ▶ Keputusan 2026-11-04)", async () => {
    const admin = await kepalaPenggunaUji("admin");
    kepala.cookie = admin.cookie;
    for (const tindakan of daftarHakTindakan) {
      await expect(wajibHakTindakan(gudangX, tindakan)).resolves.toMatchObject({ id: admin.id, peran: "admin" });
      await expect(punyaHakTindakan({ id: admin.id, peran: "admin" }, gudangX, tindakan)).resolves.toBe(true);
    }
  });

  it("admin ditolak di gudang nonaktif dan di id gudang yang tidak ada", async () => {
    const admin = await kepalaPenggunaUji("admin");
    kepala.cookie = admin.cookie;
    const nonaktif = await buatGudangUji({ aktif: false });
    try {
      for (const idGudang of [nonaktif.id, 0, 999_999]) {
        for (const tindakan of daftarHakTindakan) {
          await expect(wajibHakTindakan(idGudang, tindakan)).rejects.toBeInstanceOf(AksesDitolakError);
          await expect(punyaHakTindakan({ id: admin.id, peran: "admin" }, idGudang, tindakan)).resolves.toBe(false);
        }
      }
    } finally {
      await hapusGudangUji(nonaktif.id);
    }
  });

  it("viewer tanpa penugasan ditolak", async () => {
    kepala.cookie = (await kepalaPenggunaUji("viewer")).cookie;
    await expect(wajibHakTindakan(gudangX, "input-stok")).rejects.toBeInstanceOf(AksesDitolakError);
  });

  it("operator dengan hak input-stok di gudang X lolos untuk X dan ditolak untuk gudang Y", async () => {
    const operator = await kepalaPenggunaUji("viewer");
    await tugaskanOperator({ idPengguna: operator.id, idGudang: gudangX, hakTindakan: ["input-stok"] });
    kepala.cookie = operator.cookie;

    await expect(wajibHakTindakan(gudangX, "input-stok")).resolves.toMatchObject({ id: operator.id });
    await expect(wajibHakTindakan(gudangY, "input-stok")).rejects.toBeInstanceOf(AksesDitolakError);
  });

  it("operator hanya lolos untuk hak tindakan yang dipilih", async () => {
    const operator = await kepalaPenggunaUji("viewer");
    await tugaskanOperator({ idPengguna: operator.id, idGudang: gudangX, hakTindakan: ["input-stok", "ekspor"] });
    kepala.cookie = operator.cookie;

    await expect(wajibHakTindakan(gudangX, "ekspor")).resolves.toMatchObject({ id: operator.id });
    await expect(wajibHakTindakan(gudangX, "finalisasi")).rejects.toBeInstanceOf(AksesDitolakError);
    await expect(wajibHakTindakan(gudangX, "kelola-usulan-jadwal")).rejects.toBeInstanceOf(AksesDitolakError);
  });

  it("penugasan akun admin tidak mengurangi kelima hak tindakannya di gudang aktif", async () => {
    const admin = await kepalaPenggunaUji("admin");
    await tugaskanOperator({ idPengguna: admin.id, idGudang: gudangY, hakTindakan: ["finalisasi"] });
    kepala.cookie = admin.cookie;

    for (const tindakan of daftarHakTindakan) {
      await expect(wajibHakTindakan(gudangY, tindakan)).resolves.toMatchObject({ id: admin.id });
      await expect(wajibHakTindakan(gudangX, tindakan)).resolves.toMatchObject({ id: admin.id });
    }
  });
});

describe("akses lihat Pengiriman Gudang (T50)", () => {
  const namaGudang = ["Pusat", "Gudang Bali", "Gudang Bandung", "Gudang Cibubur", "Gudang Jabodetabek"];
  let gudangX: number;
  let gudangY: number;

  beforeAll(async () => {
    gudangX = await idGudangUji("Gudang Bali");
    gudangY = await idGudangUji("Gudang Bandung");
  });

  it("tanpa sesi: diarahkan ke halaman masuk", async () => {
    await expect(wajibAksesLihatGudang(gudangX)).rejects.toMatchObject({ digest: expect.stringContaining("/masuk") });
    await expect(wajibAksesPengirimanGudang()).rejects.toMatchObject({ digest: expect.stringContaining("/masuk") });
  });

  it("operator tanpa hak tindakan di gudang X bisa membuka X (hanya-baca) dan ditolak di Y", async () => {
    const operator = await kepalaPenggunaUji("viewer");
    await tugaskanOperator({ idPengguna: operator.id, idGudang: gudangX, hakTindakan: [] });
    kepala.cookie = operator.cookie;

    await expect(wajibAksesLihatGudang(gudangX)).resolves.toMatchObject({
      pengguna: { id: operator.id },
      gudang: { id: gudangX, nama: "Gudang Bali", hakTindakan: [] },
    });
    await expect(wajibAksesLihatGudang(gudangY)).rejects.toBeInstanceOf(AksesDitolakError);
    await expect(wajibAksesPengirimanGudang()).resolves.toMatchObject({
      daftarGudang: [{ id: gudangX, nama: "Gudang Bali", hakTindakan: [] }],
    });
    for (const tindakan of daftarHakTindakan) {
      await expect(wajibHakTindakan(gudangX, tindakan)).rejects.toBeInstanceOf(AksesDitolakError);
    }
  });

  it("operator dengan hak tindakan melihat hak tindakannya di gudang itu", async () => {
    const operator = await kepalaPenggunaUji("viewer");
    await tugaskanOperator({ idPengguna: operator.id, idGudang: gudangY, hakTindakan: ["ekspor"] });
    kepala.cookie = operator.cookie;

    await expect(wajibAksesLihatGudang(gudangY)).resolves.toMatchObject({ gudang: { hakTindakan: ["ekspor"] } });
    await expect(wajibAksesLihatGudang(gudangX)).rejects.toBeInstanceOf(AksesDitolakError);
  });

  it("admin tanpa penugasan membuka semua gudang aktif dengan kelima hak tindakan", async () => {
    kepala.cookie = (await kepalaPenggunaUji("admin")).cookie;

    const { daftarGudang } = await wajibAksesPengirimanGudang();
    expect(daftarGudang.map((g) => g.nama)).toEqual(namaGudang);
    for (const g of daftarGudang) {
      await expect(wajibAksesLihatGudang(g.id)).resolves.toMatchObject({
        gudang: { id: g.id, aktif: true, hakTindakan: [...daftarHakTindakan] },
      });
    }
  });

  it("admin yang ditugaskan tetap melihat semua gudang dengan kelima hak tindakan", async () => {
    const admin = await kepalaPenggunaUji("admin");
    await tugaskanOperator({ idPengguna: admin.id, idGudang: gudangY, hakTindakan: ["finalisasi"] });
    kepala.cookie = admin.cookie;

    const { daftarGudang } = await wajibAksesPengirimanGudang();
    expect(daftarGudang.map((g) => g.nama)).toEqual(namaGudang);
    expect(daftarGudang.find((g) => g.id === gudangY)?.hakTindakan).toEqual([...daftarHakTindakan]);
    expect(daftarGudang.find((g) => g.id === gudangX)?.hakTindakan).toEqual([...daftarHakTindakan]);
  });

  it("viewer tanpa penugasan ditolak", async () => {
    kepala.cookie = (await kepalaPenggunaUji("viewer")).cookie;
    await expect(wajibAksesPengirimanGudang()).rejects.toBeInstanceOf(AksesDitolakError);
    await expect(wajibAksesLihatGudang(gudangX)).rejects.toBeInstanceOf(AksesDitolakError);
  });

  it("gudang yang tidak ada ditolak, juga untuk admin", async () => {
    kepala.cookie = (await kepalaPenggunaUji("admin")).cookie;
    await expect(wajibAksesLihatGudang(999_999)).rejects.toBeInstanceOf(AksesDitolakError);
  });
});
