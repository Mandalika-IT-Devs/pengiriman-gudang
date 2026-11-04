import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTanggalBisnis } from "@/domain/kalender";
import { buatPenggunaUji, kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { hubunganTokoGudang, jadwalToko, pengirimanDiLuarJadwal, toko } from "@/server/db/schema";
import { bacaDraftRencana, hitungDraftRencana } from "@/server/gudang/draft-rencana";
import { jadwalTokoGudang, pilihanTokoAcuan, riwayatJadwalTetapGudang } from "@/server/gudang/jadwal";
import { simpanStokToko } from "@/server/gudang/stok-draft";
import { bersihkanTokoSmbUji, siapkanTokoSmbUji } from "@/server/gudang/uji-bantu-cakupan";
import { idGudangUji } from "@/server/gudang/uji-bantu";

const kepala = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { aturJadwalTetapToko, salinJadwalTetap } from "./aksi";

// T149 — PRD A5 ▶ Keputusan 2026-11-04 (toko acuan: Pengaturan, Perubahan dan peralihan); UAT U9.8–U9.10, U9.13. Admin
// mengisi, mengganti, atau menghapus toko acuan di form jadwal tetap satu toko; server memeriksa ulang dengan
// `validasiTokoAcuan`. Toko master MKG dan SMB dipakai seperti UAT; toko uji UJI BARU dibuat berkas ini dan jadwal
// tetapnya dinonaktifkan di akhir, supaya MKG tidak tersisa sebagai toko acuan bagi berkas test lain.

let cibubur: number;
let ujiBaru: { id: number; nama: string };
let mkg: number;
let smb: number;
/** Hubungan MKG–gudang yang dibuat berkas ini (MKG belum terhubung bila seed hubungan belum berjalan). */
let hubunganMkgDibuat = false;
let gudangMkg: number;

const idTokoMaster = async (nama: string) => (await db.select({ id: toko.id }).from(toko).where(eq(toko.nama, nama)))[0].id;

beforeAll(async () => {
  cibubur = await idGudangUji("Gudang Cibubur");
  [mkg, smb] = [await idTokoMaster("MKG"), await idTokoMaster("SMB")];
  [ujiBaru] = await db.insert(toko).values({ nama: "UJI BARU" }).returning({ id: toko.id, nama: toko.nama });
  await db.insert(hubunganTokoGudang).values({ tokoId: ujiBaru.id, gudangId: cibubur });
  const [hubungan] = await db.select().from(hubunganTokoGudang).where(eq(hubunganTokoGudang.tokoId, mkg));
  if (hubungan) {
    gudangMkg = hubungan.gudangId;
  } else {
    await db.insert(hubunganTokoGudang).values({ tokoId: mkg, gudangId: cibubur });
    [gudangMkg, hubunganMkgDibuat] = [cibubur, true];
  }
});

/** Menonaktifkan jadwal tetap aktif toko uji, sehingga toko master tidak lagi menjadi toko acuan. */
async function nonaktifkanJadwalUji(daftarIdToko: number[]) {
  const admin = await buatPenggunaUji("admin");
  await db
    .update(jadwalToko)
    .set({ status: "nonaktif", dinonaktifkanOleh: admin.id, dinonaktifkanPada: sql`now()` })
    .where(and(inArray(jadwalToko.tokoId, daftarIdToko), eq(jadwalToko.status, "aktif")));
}

afterAll(async () => {
  await nonaktifkanJadwalUji([ujiBaru.id]);
  await db
    .update(toko)
    .set({ nama: `UJI-${crypto.randomUUID()}` })
    .where(eq(toko.id, ujiBaru.id));
  if (hubunganMkgDibuat) await db.delete(hubunganTokoGudang).where(eq(hubunganTokoGudang.tokoId, mkg));
});

beforeEach(async () => {
  kepala.cookie = (await kepalaPenggunaUji("admin")).cookie;
  await nonaktifkanJadwalUji([ujiBaru.id]);
});

const riwayatJadwal = (idToko: number) => db.select().from(jadwalToko).where(eq(jadwalToko.tokoId, idToko)).orderBy(asc(jadwalToko.id));

/** UAT U9.9: UJI BARU mingguan, Selasa (H−1). */
const mingguanSelasa = { pola: "mingguan", hariKirim: [{ hari: "Selasa", persiapan: "H-1" }] } as const;

describe("admin mengatur toko acuan di jadwal tetap", () => {
  it("UJI BARU mingguan Selasa (H−1) dengan toko acuan MKG → satu versi baru; simpan ulang sama → tanpa versi baru; dikosongkan → versi baru", async () => {
    const sebelum = (await riwayatJadwal(ujiBaru.id)).length;

    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa, idTokoAcuan: mkg })).resolves.toEqual({
      keadaan: "berhasil",
    });
    const denganAcuan = await riwayatJadwal(ujiBaru.id);
    expect(denganAcuan).toHaveLength(sebelum + 1);
    expect(denganAcuan.at(-1)).toMatchObject({ status: "aktif", pola: "mingguan", tokoAcuanId: mkg });
    expect((await jadwalTokoGudang(cibubur)).find((t) => t.id === ujiBaru.id)?.jadwal).toMatchObject({
      versi: denganAcuan.at(-1)?.id,
      tokoAcuan: { id: mkg, nama: "MKG" },
    });
    expect((await riwayatJadwalTetapGudang(cibubur)).get(ujiBaru.id)?.[0]).toMatchObject({
      id: denganAcuan.at(-1)?.id,
      tokoAcuan: { id: mkg, nama: "MKG" },
      berakhir: null,
    });

    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa, idTokoAcuan: mkg })).resolves.toEqual({
      keadaan: "berhasil",
    });
    expect(await riwayatJadwal(ujiBaru.id)).toEqual(denganAcuan);

    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa })).resolves.toEqual({
      keadaan: "berhasil",
    });
    const dikosongkan = await riwayatJadwal(ujiBaru.id);
    expect(dikosongkan).toHaveLength(sebelum + 2);
    expect(dikosongkan.at(-1)).toMatchObject({ status: "aktif", pola: "mingguan", tokoAcuanId: null });
    const riwayat = (await riwayatJadwalTetapGudang(cibubur)).get(ujiBaru.id);
    expect(riwayat?.[0]).not.toHaveProperty("tokoAcuan");
    expect(riwayat?.[1]).toMatchObject({ tokoAcuan: { id: mkg, nama: "MKG" }, berakhir: { jenis: "diganti" } });
  });
});

describe("server memeriksa ulang toko acuan saat menyimpan", () => {
  it("UAT U9.10: MKG sudah menjadi toko acuan UJI BARU → jadwal MKG dengan toko acuan SMB ditolak dengan pesan PRD, jadwal MKG tidak berubah", async () => {
    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa, idTokoAcuan: mkg })).resolves.toEqual({
      keadaan: "berhasil",
    });
    const jadwalMkg = await riwayatJadwal(mkg);

    await expect(
      aturJadwalTetapToko({
        idGudang: gudangMkg,
        idToko: mkg,
        pola: "mingguan",
        hariKirim: [{ hari: "Senin", persiapan: "H" }],
        idTokoAcuan: smb,
      }),
    ).resolves.toEqual({
      keadaan: "gagal",
      pesan: "Toko MKG menjadi toko acuan untuk UJI BARU, jadi tidak bisa memakai toko acuan sendiri.",
    });
    expect(await riwayatJadwal(mkg)).toEqual(jadwalMkg);
  });

  it("toko itu sendiri, toko acuan nonaktif, dan toko acuan yang memakai toko acuan sendiri ditolak tanpa menulis", async () => {
    const [nonaktif] = await db
      .insert(toko)
      .values({ nama: `UJI-${crypto.randomUUID()}`, aktif: false })
      .returning();
    const [peminjam] = await db
      .insert(toko)
      .values({ nama: `UJI-${crypto.randomUUID()}` })
      .returning();
    await db.insert(hubunganTokoGudang).values({ tokoId: peminjam.id, gudangId: cibubur });
    await aturJadwalTetapToko({ idGudang: cibubur, idToko: peminjam.id, ...mingguanSelasa, idTokoAcuan: smb });
    const sebelum = await riwayatJadwal(ujiBaru.id);

    for (const [idTokoAcuan, pesan] of [
      [ujiBaru.id, "Toko acuan tidak boleh toko ini sendiri."],
      [nonaktif.id, `Toko ${nonaktif.nama} nonaktif, jadi tidak bisa menjadi toko acuan.`],
      [peminjam.id, `Toko ${peminjam.nama} memakai toko acuan sendiri, jadi tidak bisa menjadi toko acuan.`],
      [2_000_000_000, "Toko acuan tidak ditemukan. Muat ulang halaman, lalu pilih lagi."],
    ] as const) {
      await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa, idTokoAcuan })).resolves.toEqual({
        keadaan: "gagal",
        pesan,
      });
    }
    expect(await riwayatJadwal(ujiBaru.id)).toEqual(sebelum);
    await nonaktifkanJadwalUji([peminjam.id]);
  });
});

describe("pilihan toko acuan", () => {
  it("toko aktif urut nama, termasuk yang belum terhubung ke gudang; tanpa toko nonaktif dan toko yang memakai toko acuan", async () => {
    const [nonaktif] = await db
      .insert(toko)
      .values({ nama: `UJI-${crypto.randomUUID()}`, aktif: false })
      .returning();
    const [belumTerhubung] = await db
      .insert(toko)
      .values({ nama: `UJI-${crypto.randomUUID()}` })
      .returning();
    await aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa, idTokoAcuan: mkg });

    const pilihan = await pilihanTokoAcuan();
    const id = pilihan.map((p) => p.id);
    expect(id).toContain(belumTerhubung.id);
    expect(id).toContain(mkg);
    expect(id).not.toContain(nonaktif.id);
    expect(id).not.toContain(ujiBaru.id);
    expect(pilihan.find((p) => p.id === mkg)).toEqual({ id: mkg, nama: "MKG" });
    // Urut nama: toko master contoh tampil dalam urutan abjadnya.
    const urutanMaster = ["ALSUT", "BOTANI", "KOKAS", "MKG", "PMS", "SMB"];
    expect(pilihan.map((p) => p.nama).filter((n) => urutanMaster.includes(n))).toEqual(urutanMaster);
  });
});

describe("toko acuan dan versi jadwal", () => {
  it("jadwal tetap yang sudah ada (tanpa kolom toko acuan diisi) tampil tanpa toko acuan", async () => {
    const admin = await buatPenggunaUji("admin");
    const [lama] = await db
      .insert(jadwalToko)
      .values({ tokoId: ujiBaru.id, pola: "mingguan", hariKirim: [{ hari: "Selasa", persiapanHari: 1 }], dibuatOleh: admin.id })
      .returning();
    expect(lama.tokoAcuanId).toBeNull();
    const aktif = (await jadwalTokoGudang(cibubur)).find((t) => t.id === ujiBaru.id)?.jadwal;
    expect(aktif).toMatchObject({ versi: lama.id, pola: "mingguan" });
    expect(aktif).not.toHaveProperty("tokoAcuan");
    expect((await riwayatJadwalTetapGudang(cibubur)).get(ujiBaru.id)?.[0]).not.toHaveProperty("tokoAcuan");

    // Menyimpan ulang isian yang sama tanpa toko acuan tidak membuat versi baru.
    await aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa });
    expect((await riwayatJadwal(ujiBaru.id)).at(-1)).toMatchObject({ id: lama.id, status: "aktif" });
  });

  it("mengganti toko acuan → versi baru dengan toko acuan pengganti", async () => {
    await aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa, idTokoAcuan: mkg });
    const [mkgVersi] = (await riwayatJadwal(ujiBaru.id)).slice(-1);
    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa, idTokoAcuan: smb })).resolves.toEqual({
      keadaan: "berhasil",
    });
    expect((await riwayatJadwal(ujiBaru.id)).slice(-2)).toMatchObject([
      { id: mkgVersi.id, status: "nonaktif", tokoAcuanId: mkg },
      { status: "aktif", tokoAcuanId: smb },
    ]);
  });

  it("Salin jadwal belum mengatur toko acuan (T150): toko acuan jadwal aktif tetap terbawa ke versi baru", async () => {
    await aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa, idTokoAcuan: mkg });
    await expect(
      salinJadwalTetap({
        idGudang: cibubur,
        daftarIdToko: [ujiBaru.id],
        pola: "mingguan",
        hariKirim: [{ hari: "Rabu", persiapan: "H-1" }],
      }),
    ).resolves.toEqual({ keadaan: "berhasil", hasil: [{ idToko: ujiBaru.id, status: "berhasil" }] });
    expect((await riwayatJadwal(ujiBaru.id)).at(-1)).toMatchObject({
      status: "aktif",
      hariKirim: [{ hari: "Rabu", persiapanHari: 1 }],
      tokoAcuanId: mkg,
    });
  });

  it("mengisi lalu menghapus toko acuan → pengiriman di luar jadwal tetap Menunggu atau Berlaku", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-15T09:00:00+07:00") });
    try {
      const admin = await buatPenggunaUji("admin");
      await aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa });
      const dasar = {
        gudangId: cibubur,
        tokoId: ujiBaru.id,
        persiapanHari: 1,
        alasan: "uji",
        diusulkanOleh: admin.id,
      } as const;
      const daftar = await db
        .insert(pengirimanDiLuarJadwal)
        .values([
          {
            ...dasar,
            jenis: "tambahan",
            tanggalKirim: "2026-10-22",
            status: "berlaku",
            diputuskanOleh: admin.id,
            diputuskanPada: new Date(),
          },
          { ...dasar, jenis: "tambahan", tanggalKirim: "2026-10-23", status: "menunggu" },
          {
            ...dasar,
            jenis: "pindah",
            tanggalRutinDipindah: "2026-10-20",
            tanggalKirim: "2026-10-21",
            status: "berlaku",
            diputuskanOleh: admin.id,
            diputuskanPada: new Date(),
          },
        ])
        .returning({ id: pengirimanDiLuarJadwal.id });
      const status = async () =>
        (
          await db
            .select({ status: pengirimanDiLuarJadwal.status })
            .from(pengirimanDiLuarJadwal)
            .where(
              inArray(
                pengirimanDiLuarJadwal.id,
                daftar.map((d) => d.id),
              ),
            )
            .orderBy(asc(pengirimanDiLuarJadwal.id))
        ).map((p) => p.status);

      for (const idTokoAcuan of [mkg, null]) {
        await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: ujiBaru.id, ...mingguanSelasa, idTokoAcuan })).resolves.toEqual({
          keadaan: "berhasil",
        });
        expect(await status()).toEqual(["berlaku", "menunggu", "berlaku"]);
      }
      await db.delete(pengirimanDiLuarJadwal).where(eq(pengirimanDiLuarJadwal.tokoId, ujiBaru.id));
    } finally {
      vi.useRealTimers();
    }
  });
});

// UAT U9.13 dan PRD A5 ▶ Keputusan 2026-11-04 (Perubahan dan peralihan): mengubah toko acuan menandai draft belum final
// perlu dihitung ulang karena "Jadwal toko" (alasan `jadwal`), dengan stok yang sudah diisi tetap ada. Angka draft belum
// memakai toko acuan (T151).
describe("toko acuan dari form admin: draft belum final", () => {
  /** Kamis 29-10-2026 (golden toko-acuan.json `kasusKebutuhan`), mingguan Kamis (H−1). */
  const KAMIS = parseTanggalBisnis("2026-10-29");
  const mingguanKamis = { pola: "mingguan", hariKirim: [{ hari: "Kamis", persiapan: "H-1" }] } as const;
  const STOK_AKHIR = 20;

  let bandung: number;
  let tokoDraft: { id: number; nama: string };
  let kodeProduk: string;
  let idOperator: string;

  beforeAll(async () => {
    bandung = await idGudangUji("Gudang Bandung");
    idOperator = (await buatPenggunaUji("viewer")).id;
    ({ toko: tokoDraft, kodeProduk } = await siapkanTokoSmbUji({ idGudang: bandung, idAdmin: (await buatPenggunaUji("admin")).id }));
  }, 120_000);

  afterAll(async () => {
    await nonaktifkanJadwalUji([tokoDraft.id]);
    await bersihkanTokoSmbUji({ idGudang: bandung, idToko: tokoDraft.id });
  });

  const hitung = async () =>
    expect(await hitungDraftRencana({ idGudang: bandung, tanggalKirim: KAMIS, idPengguna: idOperator })).toMatchObject({
      keadaan: "berhasil",
    });
  const draft = () => bacaDraftRencana(bandung, KAMIS);
  const barisProduk = async () => (await draft())?.toko.find((t) => t.id === tokoDraft.id)?.baris.find((b) => b.kodeProduk === kodeProduk);

  it('mengisi lalu menghapus toko acuan → draft ditandai perlu dihitung ulang ("Jadwal toko"), stok tetap ada', async () => {
    await aturJadwalTetapToko({ idGudang: bandung, idToko: tokoDraft.id, ...mingguanKamis });
    await hitung();
    expect(
      await simpanStokToko({ idGudang: bandung, tanggalKirim: KAMIS, tokoId: tokoDraft.id, stok: [{ kodeProduk, stokAkhir: STOK_AKHIR }] }),
    ).toEqual({ keadaan: "berhasil" });
    expect((await draft())?.perluDihitungUlang).toEqual([]);

    for (const idTokoAcuan of [mkg, null]) {
      await expect(aturJadwalTetapToko({ idGudang: bandung, idToko: tokoDraft.id, ...mingguanKamis, idTokoAcuan })).resolves.toEqual({
        keadaan: "berhasil",
      });
      expect((await draft())?.perluDihitungUlang).toEqual(["jadwal"]);
      expect(await barisProduk()).toMatchObject({ stokAkhir: STOK_AKHIR });
      await hitung();
      expect((await draft())?.perluDihitungUlang).toEqual([]);
      expect(await barisProduk()).toMatchObject({ stokAkhir: STOK_AKHIR });
    }
  });
});
