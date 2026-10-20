import { describe, expect, it } from "vitest";

import { dekripsiSalinan, enkripsiSalinan } from "./salinan-kata-sandi";

// T137 (PRD A3 ▶ Keputusan 2026-10-20): salinan kata sandi akun bukan admin disimpan terenkripsi AES-256-GCM. Kuncinya
// diturunkan dari rahasia aplikasi (BETTER_AUTH_SECRET), jadi tidak pernah ada di database atau backup `pg_dump`.

const RAHASIA = "rahasia-uji-salinan-kata-sandi-0123456789-abcdef";
const RAHASIA_LAIN = "rahasia-lain-yang-bukan-milik-aplikasi-ini-987654";
const IKATAN = "pengguna-1\n$hash-kata-sandi-yang-berlaku";

describe("salinan kata sandi terenkripsi", () => {
  it("bolak-balik: salinan terbaca lagi dengan kunci dan ikatan yang sama", () => {
    const salinan = enkripsiSalinan("Kata-Sandi Baru 123", IKATAN, RAHASIA);
    expect(dekripsiSalinan(salinan, IKATAN, RAHASIA)).toBe("Kata-Sandi Baru 123");
  });

  it("salinan tidak memuat kata sandi dalam bentuk terbaca", () => {
    const salinan = enkripsiSalinan("sandi-terbaca-sekali", IKATAN, RAHASIA);
    expect(salinan).not.toContain("sandi-terbaca-sekali");
    expect(Buffer.from(salinan).toString("latin1")).not.toContain("sandi");
  });

  it("IV acak: dua enkripsi kata sandi yang sama menghasilkan salinan berbeda", () => {
    expect(enkripsiSalinan("sama-persis-123", IKATAN, RAHASIA)).not.toBe(enkripsiSalinan("sama-persis-123", IKATAN, RAHASIA));
  });

  it("kunci lain (rahasia aplikasi berganti) tidak bisa membaca salinan", () => {
    const salinan = enkripsiSalinan("rahasia-pengguna-1", IKATAN, RAHASIA);
    expect(dekripsiSalinan(salinan, IKATAN, RAHASIA_LAIN)).toBeNull();
  });

  it("salinan yang terikat ke kata sandi lama tidak terbaca setelah kata sandi berganti", () => {
    const salinan = enkripsiSalinan("rahasia-pengguna-1", IKATAN, RAHASIA);
    expect(dekripsiSalinan(salinan, "pengguna-1\n$hash-baru", RAHASIA)).toBeNull();
    expect(dekripsiSalinan(salinan, "pengguna-2\n$hash-kata-sandi-yang-berlaku", RAHASIA)).toBeNull();
  });

  it("salinan rusak atau berformat asing dianggap tidak terbaca", () => {
    const salinan = enkripsiSalinan("rahasia-pengguna-1", IKATAN, RAHASIA);
    const [versi, iv, tag, isi] = salinan.split(".");
    const isiRusak = Buffer.from(isi!, "base64url");
    isiRusak[0] = isiRusak[0]! ^ 1;
    expect(dekripsiSalinan([versi, iv, tag, isiRusak.toString("base64url")].join("."), IKATAN, RAHASIA)).toBeNull();
    expect(dekripsiSalinan("bukan-salinan", IKATAN, RAHASIA)).toBeNull();
    expect(dekripsiSalinan("", IKATAN, RAHASIA)).toBeNull();
  });

  it("tanpa rahasia eksplisit memakai BETTER_AUTH_SECRET", () => {
    const salinan = enkripsiSalinan("dari-rahasia-aplikasi", IKATAN);
    expect(dekripsiSalinan(salinan, IKATAN, process.env.BETTER_AUTH_SECRET)).toBe("dari-rahasia-aplikasi");
    expect(dekripsiSalinan(salinan, IKATAN, RAHASIA)).toBeNull();
  });
});
