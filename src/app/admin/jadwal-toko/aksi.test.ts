import { readFileSync } from "node:fs";
import { join } from "node:path";

import { asc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTanggalBisnis } from "@/domain/kalender";
import { AksesDitolakError } from "@/server/auth/kewenangan";
import { buatPenggunaUji, kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { hubunganTokoGudang, jadwalToko, pengirimanDiLuarJadwal, usulanJadwal } from "@/server/db/schema";
import { bacaDraftRencana, hitungDraftRencana } from "@/server/gudang/draft-rencana";
import { jadwalTokoGudang, riwayatJadwalTetapGudang } from "@/server/gudang/jadwal";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { bacaRencanaFinal, finalisasiRencanaToko } from "@/server/gudang/rencana-final";
import { salinJadwalKeToko } from "@/server/gudang/salin-jadwal";
import { simpanStokToko } from "@/server/gudang/stok-draft";
import { bersihkanTokoSmbUji, siapkanTokoSmbUji } from "@/server/gudang/uji-bantu-cakupan";
import { buatTokoUji, idGudangUji, rencanaFinalUji } from "@/server/gudang/uji-bantu";

const kepala = vi.hoisted(() => ({ cookie: "", muatUlangGagal: false, dimuatUlang: [] as string[] }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    if (kepala.muatUlangGagal) throw new Error("gagal memuat ulang");
    kepala.dimuatUlang.push(path);
  },
}));

import { aturJadwalTetapToko, nonaktifkanJadwalTetapToko, salinJadwalTetap } from "./aksi";

// T112 (PRD A5 ▶ Revisi 2026-10-13): jadwal tetap diatur admin, langsung berlaku tanpa usulan, untuk semua gudang
// termasuk Pusat. Riwayat jadwal tetap tetap tersimpan; salin jadwal menjadi alat admin dengan hasil per toko.

let pusat: number;
let cibubur: number;
let bali: number;

beforeAll(async () => {
  pusat = await idGudangUji("Pusat");
  cibubur = await idGudangUji("Gudang Cibubur");
  bali = await idGudangUji("Gudang Bali");
});

beforeEach(() => {
  kepala.cookie = "";
  kepala.muatUlangGagal = false;
  kepala.dimuatUlang = [];
});

async function tokoDiGudang(idGudang: number) {
  const t = await buatTokoUji();
  await db.insert(hubunganTokoGudang).values({ tokoId: t.id, gudangId: idGudang });
  return t;
}

async function masukAdmin() {
  const admin = await kepalaPenggunaUji("admin");
  kepala.cookie = admin.cookie;
  return admin;
}

const riwayatJadwal = (idToko: number) => db.select().from(jadwalToko).where(eq(jadwalToko.tokoId, idToko)).orderBy(asc(jadwalToko.id));
const daftarUsulan = (idToko: number) => db.select().from(usulanJadwal).where(eq(usulanJadwal.tokoId, idToko));

/** 2× seminggu Senin (H−2) + Kamis (H). */
const pengaturan = {
  pola: "2x-seminggu",
  hariKirim: [
    { hari: "Kamis", persiapan: "H" },
    { hari: "Senin", persiapan: "H-2" },
  ],
} as const;
const hariKirimTersimpan = [
  { hari: "Senin", persiapanHari: 2 },
  { hari: "Kamis", persiapanHari: 0 },
];

describe("admin mengatur jadwal tetap", () => {
  for (const [namaGudang, gudangUji] of [
    ["gudang selain Pusat", () => cibubur],
    ["Pusat", () => pusat],
  ] as const) {
    it(`${namaGudang}: langsung aktif tanpa usulan; jadwal lama nonaktif dan tampil di riwayat dengan pengatur dan waktunya`, async () => {
      const idGudang = gudangUji();
      const t = await tokoDiGudang(idGudang);
      const admin = await masukAdmin();

      await expect(
        aturJadwalTetapToko({ idGudang, idToko: t.id, pola: "mingguan", hariKirim: [{ hari: "Rabu", persiapan: "H-1" }] }),
      ).resolves.toEqual({
        keadaan: "berhasil",
      });
      expect(kepala.dimuatUlang).toEqual([
        `/admin/jadwal-toko/${idGudang}`,
        `/pengiriman-gudang/${idGudang}`,
        `/usulan-jadwal/${idGudang}`,
        "/admin/jadwal",
      ]);
      await expect(aturJadwalTetapToko({ idGudang, idToko: t.id, ...pengaturan })).resolves.toEqual({ keadaan: "berhasil" });

      const [lama, baru] = await riwayatJadwal(t.id);
      expect(lama).toMatchObject({ status: "nonaktif", pola: "mingguan", dibuatOleh: admin.id, dinonaktifkanOleh: admin.id });
      expect(baru).toMatchObject({ status: "aktif", pola: "2x-seminggu", hariKirim: hariKirimTersimpan, dibuatOleh: admin.id });
      expect(await daftarUsulan(t.id)).toEqual([]);

      const aktif = (await jadwalTokoGudang(idGudang)).find((x) => x.id === t.id)?.jadwal;
      expect(aktif).toMatchObject({ versi: baru.id, pola: "2x-seminggu" });

      const riwayat = (await riwayatJadwalTetapGudang(idGudang)).get(t.id);
      expect(riwayat).toEqual([
        {
          id: baru.id,
          pola: "2x-seminggu",
          hariKirim: hariKirimTersimpan,
          tambah3HariCakupan: false,
          diaturOleh: "Uji admin",
          diaturPada: baru.dibuatPada,
          berakhir: null,
        },
        {
          id: lama.id,
          pola: "mingguan",
          hariKirim: [{ hari: "Rabu", persiapanHari: 1 }],
          tambah3HariCakupan: false,
          diaturOleh: "Uji admin",
          diaturPada: lama.dibuatPada,
          berakhir: { jenis: "diganti", oleh: "Uji admin", pada: baru.dibuatPada },
        },
      ]);
    });
  }

  it("toko yang tidak terhubung ke gudang itu ditolak tanpa menulis", async () => {
    const t = await tokoDiGudang(bali);
    await masukAdmin();
    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...pengaturan })).resolves.toEqual({
      keadaan: "gagal",
      pesan: "Toko tidak terhubung ke gudang ini. Muat ulang halaman, lalu pilih lagi.",
    });
    expect(await riwayatJadwal(t.id)).toEqual([]);
  });

  it("aturan jadwal tidak valid → gagal dengan pesan domain", async () => {
    const t = await tokoDiGudang(cibubur);
    await masukAdmin();
    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, pola: "dua-mingguan", hariKirim: [] })).resolves.toEqual({
      keadaan: "gagal",
      pesan: "Pola dua mingguan membutuhkan minimal 1 hari kirim, dipilih 0.",
    });
    expect(await riwayatJadwal(t.id)).toEqual([]);
  });

  // T135 — PRD A5 ▶ Revisi 2026-10-19: dua mingguan tanpa tanggal jangkar.
  it("dua mingguan Rabu (H−1) tersimpan tanpa tanggal jangkar", async () => {
    const t = await tokoDiGudang(cibubur);
    const admin = await masukAdmin();
    await expect(
      aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, pola: "dua-mingguan", hariKirim: [{ hari: "Rabu", persiapan: "H-1" }] }),
    ).resolves.toEqual({ keadaan: "berhasil" });
    expect(await riwayatJadwal(t.id)).toMatchObject([
      {
        status: "aktif",
        pola: "dua-mingguan",
        hariKirim: [{ hari: "Rabu", persiapanHari: 1 }],
        tanggalJangkar: null,
        dibuatOleh: admin.id,
      },
    ]);
  });

  it("isian tanggal jangkar dari klien lama diabaikan: jadwal tetap tersimpan tanpa jangkar", async () => {
    const t = await tokoDiGudang(cibubur);
    await masukAdmin();
    await expect(
      aturJadwalTetapToko({
        idGudang: cibubur,
        idToko: t.id,
        pola: "dua-mingguan",
        hariKirim: [{ hari: "Rabu", persiapan: "H-1" }],
        tanggalJangkar: "2026-10-14",
      }),
    ).resolves.toEqual({ keadaan: "berhasil" });
    expect(await riwayatJadwal(t.id)).toMatchObject([{ status: "aktif", pola: "dua-mingguan", tanggalJangkar: null }]);
  });

  it("menyimpan ulang jadwal dua mingguan lama berjangkar dengan pola, hari kirim, dan persiapan sama → tidak membuat versi baru", async () => {
    const t = await tokoDiGudang(cibubur);
    const admin = await masukAdmin();
    // Jadwal lama (seed BXC sebelum T135): dua mingguan Rabu (H−1), jangkar 2026-10-14.
    const [lama] = await db
      .insert(jadwalToko)
      .values({
        tokoId: t.id,
        pola: "dua-mingguan",
        hariKirim: [{ hari: "Rabu", persiapanHari: 1 }],
        tanggalJangkar: "2026-10-14",
        dibuatOleh: admin.id,
      })
      .returning();

    await expect(
      aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, pola: "dua-mingguan", hariKirim: [{ hari: "Rabu", persiapan: "H-1" }] }),
    ).resolves.toEqual({ keadaan: "berhasil" });
    expect(await riwayatJadwal(t.id)).toEqual([lama]);

    // Persiapan berubah → versi baru tanpa jangkar; versi lama tetap menyimpan jangkarnya sebagai riwayat.
    await expect(
      aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, pola: "dua-mingguan", hariKirim: [{ hari: "Rabu", persiapan: "H-2" }] }),
    ).resolves.toEqual({ keadaan: "berhasil" });
    expect(await riwayatJadwal(t.id)).toMatchObject([
      { id: lama.id, status: "nonaktif", tanggalJangkar: "2026-10-14" },
      { status: "aktif", pola: "dua-mingguan", hariKirim: [{ hari: "Rabu", persiapanHari: 2 }], tanggalJangkar: null },
    ]);
  });

  it("tersimpan tetapi gagal memuat ulang → keadaan kelima", async () => {
    const t = await tokoDiGudang(cibubur);
    await masukAdmin();
    kepala.muatUlangGagal = true;
    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...pengaturan })).resolves.toEqual({
      keadaan: "tersimpanGagalMuatUlang",
    });
  });
});

// T144 — PRD A5 ▶ Keputusan 2026-10-27 (Pengaturan; Perubahan dan peralihan): mencentang atau melepas "Tambah 3 hari
// cakupan" adalah perubahan jadwal tetap. Menyimpan ulang dengan pola, hari kirim, persiapan, dan pilihan yang sama tidak
// membuat versi baru.
describe("admin mengatur Tambah 3 hari cakupan", () => {
  /** DELTAMAS di UAT A5.16: mingguan, Kamis (H−1). */
  const deltamas = { pola: "mingguan", hariKirim: [{ hari: "Kamis", persiapan: "H-1" }] } as const;

  it("mencentang lalu menyimpan → jadwal tetap aktif bertanda dan satu entri riwayat baru bertanda; simpan ulang tanpa perubahan tidak menambah versi", async () => {
    const t = await tokoDiGudang(cibubur);
    await masukAdmin();
    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...deltamas })).resolves.toEqual({ keadaan: "berhasil" });
    const [awal] = await riwayatJadwal(t.id);
    expect(awal).toMatchObject({ status: "aktif", tambah3HariCakupan: false });

    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...deltamas, tambah3HariCakupan: true })).resolves.toEqual({
      keadaan: "berhasil",
    });
    const [lama, baru] = await riwayatJadwal(t.id);
    expect(lama).toMatchObject({ id: awal.id, status: "nonaktif", tambah3HariCakupan: false });
    expect(baru).toMatchObject({
      status: "aktif",
      pola: "mingguan",
      hariKirim: [{ hari: "Kamis", persiapanHari: 1 }],
      tambah3HariCakupan: true,
    });
    expect((await jadwalTokoGudang(cibubur)).find((x) => x.id === t.id)?.jadwal).toMatchObject({
      versi: baru.id,
      tambah3HariCakupan: true,
    });
    expect((await riwayatJadwalTetapGudang(cibubur)).get(t.id)).toMatchObject([
      { id: baru.id, tambah3HariCakupan: true, berakhir: null },
      { id: lama.id, tambah3HariCakupan: false, berakhir: { jenis: "diganti" } },
    ]);

    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...deltamas, tambah3HariCakupan: true })).resolves.toEqual({
      keadaan: "berhasil",
    });
    expect(await riwayatJadwal(t.id)).toEqual([lama, baru]);
  });

  it("melepas centang → versi baru tanpa tanda; simpan ulang tanpa centang tidak menambah versi", async () => {
    const t = await tokoDiGudang(cibubur);
    await masukAdmin();
    await aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...deltamas, tambah3HariCakupan: true });
    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...deltamas, tambah3HariCakupan: false })).resolves.toEqual({
      keadaan: "berhasil",
    });
    expect(await riwayatJadwal(t.id)).toMatchObject([
      { status: "nonaktif", tambah3HariCakupan: true },
      { status: "aktif", tambah3HariCakupan: false },
    ]);
    await aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...deltamas, tambah3HariCakupan: false });
    expect(await riwayatJadwal(t.id)).toHaveLength(2);
  });
});

// T144 — UAT A5.16, A6.25, dan A6.27 (PRD A5 ▶ Keputusan 2026-10-27, Perubahan dan peralihan): pilihan yang dicentang atau
// dilepas admin menandai draft belum final perlu dihitung ulang dengan stok tetap ada; setelah dihitung ulang cakupannya
// mengikuti pilihan baru, dan rencana final yang sudah ada tidak berubah. Angka dari golden tambah-3-hari-cakupan.json
// (contoh pemilik, mingguan Kamis H−1) dan UAT A6.27.
describe("Tambah 3 hari cakupan dari form admin: draft dan rencana final (mingguan Kamis H−1)", () => {
  const contoh = (
    JSON.parse(readFileSync(join(import.meta.dirname, "../../../../tests/golden/tambah-3-hari-cakupan.json"), "utf8")) as {
      kasusContohPemilik: {
        tanggalKirim: string;
        tanggalCakupan: { tanggal: string }[];
        kebutuhan: number;
        jumlahKirim: { stokAkhir: number; jumlahKirim: number };
        tanpaTambahan: { akhirCakupan: string; jumlahHari: number };
      };
    }
  ).kasusContohPemilik;
  const KAMIS = parseTanggalBisnis(contoh.tanggalKirim);
  /** UAT A6.27: Kamis berikutnya. */
  const KAMIS_BERIKUTNYA = parseTanggalBisnis("2026-11-05");
  const deltamas = { pola: "mingguan", hariKirim: [{ hari: "Kamis", persiapan: "H-1" }] } as const;

  let bandung: number;
  let toko: { id: number; nama: string };
  let kodeProduk: string;
  let idOperator: string;

  beforeAll(async () => {
    bandung = await idGudangUji("Gudang Bandung");
    idOperator = (await buatPenggunaUji("viewer")).id;
    ({ toko, kodeProduk } = await siapkanTokoSmbUji({ idGudang: bandung, idAdmin: (await buatPenggunaUji("admin")).id }));
  }, 120_000);

  afterAll(async () => {
    await bersihkanTokoSmbUji({ idGudang: bandung, idToko: toko.id });
  });

  const hitung = async (tanggalKirim: typeof KAMIS) =>
    expect(await hitungDraftRencana({ idGudang: bandung, tanggalKirim, idPengguna: idOperator })).toMatchObject({ keadaan: "berhasil" });
  const tokoDi = async (tanggalKirim: typeof KAMIS) => (await bacaDraftRencana(bandung, tanggalKirim))?.toko.find((t) => t.id === toko.id);
  const barisProduk = async (tanggalKirim: typeof KAMIS) => (await tokoDi(tanggalKirim))?.baris.find((b) => b.kodeProduk === kodeProduk);
  const tanggalCakupan = async (tanggalKirim: typeof KAMIS) => (await tokoDi(tanggalKirim))?.cakupan?.map((c) => c.tanggal);
  const isiStok = async (tanggalKirim: typeof KAMIS) =>
    expect(
      await simpanStokToko({
        idGudang: bandung,
        tanggalKirim,
        tokoId: toko.id,
        stok: [{ kodeProduk, stokAkhir: contoh.jumlahKirim.stokAkhir }],
      }),
    ).toEqual({ keadaan: "berhasil" });

  it("mencentang → draft belum final perlu dihitung ulang, stok tetap; setelah dihitung ulang berisi 3 tanggal tambahan (UAT A6.25)", async () => {
    await masukAdmin();
    await expect(aturJadwalTetapToko({ idGudang: bandung, idToko: toko.id, ...deltamas })).resolves.toEqual({ keadaan: "berhasil" });
    await hitung(KAMIS);
    await isiStok(KAMIS);
    expect(await tanggalCakupan(KAMIS)).toHaveLength(contoh.tanpaTambahan.jumlahHari);

    await expect(aturJadwalTetapToko({ idGudang: bandung, idToko: toko.id, ...deltamas, tambah3HariCakupan: true })).resolves.toEqual({
      keadaan: "berhasil",
    });
    expect((await bacaDraftRencana(bandung, KAMIS))?.perluDihitungUlang).toContain("jadwal");
    expect(await barisProduk(KAMIS)).toMatchObject({ stokAkhir: contoh.jumlahKirim.stokAkhir });

    await hitung(KAMIS);
    expect(await tokoDi(KAMIS)).toMatchObject({ perluDihitungUlang: [], tambah3HariCakupan: true });
    expect(await tanggalCakupan(KAMIS)).toEqual(contoh.tanggalCakupan.map((c) => c.tanggal));
    expect(await barisProduk(KAMIS)).toMatchObject({
      kebutuhan: contoh.kebutuhan,
      stokAkhir: contoh.jumlahKirim.stokAkhir,
      jumlahKirim: contoh.jumlahKirim.jumlahKirim,
    });
  });

  it("melepas centang → versi baru tanpa tanda; draft belum final perlu dihitung ulang dengan stok tetap; rencana final tidak berubah (UAT A6.27)", async () => {
    const final = await finalisasiRencanaToko({
      idGudang: bandung,
      tanggalKirim: KAMIS,
      tokoId: toko.id,
      idPengguna: idOperator,
      versiDilihat: (await tokoDi(KAMIS))?.versi ?? "",
    });
    if (final.keadaan !== "berhasil") throw new Error(final.pesan);
    const rencanaSebelum = await bacaRencanaFinal(bandung, final.idRencana);
    expect(rencanaSebelum?.jadwal).toMatchObject({ tambah3HariCakupan: true });

    await hitung(KAMIS_BERIKUTNYA);
    await isiStok(KAMIS_BERIKUTNYA);
    expect(await tanggalCakupan(KAMIS_BERIKUTNYA)).toHaveLength(11);

    await masukAdmin();
    await expect(aturJadwalTetapToko({ idGudang: bandung, idToko: toko.id, ...deltamas, tambah3HariCakupan: false })).resolves.toEqual({
      keadaan: "berhasil",
    });
    expect((await riwayatJadwal(toko.id)).at(-1)).toMatchObject({ status: "aktif", tambah3HariCakupan: false });
    expect((await bacaDraftRencana(bandung, KAMIS_BERIKUTNYA))?.perluDihitungUlang).toContain("jadwal");
    expect(await barisProduk(KAMIS_BERIKUTNYA)).toMatchObject({ stokAkhir: contoh.jumlahKirim.stokAkhir });
    expect(await bacaRencanaFinal(bandung, final.idRencana)).toEqual(rencanaSebelum);

    await hitung(KAMIS_BERIKUTNYA);
    const cakupan = await tanggalCakupan(KAMIS_BERIKUTNYA);
    expect([cakupan?.length, cakupan?.[0], cakupan?.at(-1)]).toEqual([8, "2026-11-04", "2026-11-11"]);
    expect(await tokoDi(KAMIS_BERIKUTNYA)).not.toHaveProperty("tambah3HariCakupan");
  });
});

describe("admin menonaktifkan jadwal tetap", () => {
  const SENIN = parseTanggalBisnis("2026-10-19");
  let bandung: number;
  let toko: { id: number; nama: string };
  let idOperator: string;

  beforeAll(async () => {
    bandung = await idGudangUji("Gudang Bandung");
    idOperator = (await buatPenggunaUji("viewer")).id;
    ({ toko } = await siapkanTokoSmbUji({ idGudang: bandung, idAdmin: (await buatPenggunaUji("admin")).id }));
  }, 120_000);

  afterAll(async () => {
    await bersihkanTokoSmbUji({ idGudang: bandung, idToko: toko.id });
  });

  it("toko tanpa jadwal aktif; draft yang memuat toko itu ditandai perlu dihitung ulang; riwayat mencatat penonaktifan", async () => {
    await expect(hitungDraftRencana({ idGudang: bandung, tanggalKirim: SENIN, idPengguna: idOperator })).resolves.toMatchObject({
      keadaan: "berhasil",
    });
    const draft = await bacaDraftRencana(bandung, SENIN);
    expect(draft?.toko.map((t) => t.id)).toContain(toko.id);
    expect(draft?.perluDihitungUlang).toEqual([]);

    const admin = await masukAdmin();
    await expect(nonaktifkanJadwalTetapToko({ idGudang: bandung, idToko: toko.id })).resolves.toEqual({ keadaan: "berhasil" });

    expect((await jadwalTokoGudang(bandung)).find((t) => t.id === toko.id)?.jadwal).toBeNull();
    expect((await bacaDraftRencana(bandung, SENIN))?.perluDihitungUlang).toContain("jadwal");

    const [satu] = await riwayatJadwal(toko.id);
    expect(satu).toMatchObject({ status: "nonaktif", dinonaktifkanOleh: admin.id });
    expect((await riwayatJadwalTetapGudang(bandung)).get(toko.id)).toMatchObject([
      { id: satu.id, berakhir: { jenis: "dinonaktifkan", oleh: "Uji admin", pada: satu.dinonaktifkanPada } },
    ]);

    // Toko tanpa jadwal aktif tidak bisa dinonaktifkan lagi.
    await expect(nonaktifkanJadwalTetapToko({ idGudang: bandung, idToko: toko.id })).resolves.toEqual({
      keadaan: "gagal",
      pesan: "Toko ini tidak punya jadwal aktif. Muat ulang halaman untuk melihat jadwal terbaru.",
    });
  });
});

describe("salin jadwal admin ke beberapa toko", () => {
  it("3 toko langsung memakai jadwal itu; toko yang tidak terhubung ke gudang itu ditolak dengan pesan", async () => {
    const admin = await masukAdmin();
    const [a, b, c] = [await tokoDiGudang(cibubur), await tokoDiGudang(cibubur), await tokoDiGudang(cibubur)];
    const lain = await tokoDiGudang(bali);

    await expect(salinJadwalTetap({ idGudang: cibubur, daftarIdToko: [a.id, lain.id, b.id, c.id], ...pengaturan })).resolves.toEqual({
      keadaan: "berhasil",
      hasil: [
        { idToko: a.id, status: "berhasil" },
        { idToko: lain.id, status: "ditolak", pesan: "Toko tidak terhubung ke gudang ini. Muat ulang halaman, lalu pilih lagi." },
        { idToko: b.id, status: "berhasil" },
        { idToko: c.id, status: "berhasil" },
      ],
    });
    for (const t of [a, b, c]) {
      expect(await riwayatJadwal(t.id)).toMatchObject([
        { status: "aktif", pola: "2x-seminggu", hariKirim: hariKirimTersimpan, dibuatOleh: admin.id },
      ]);
      expect(await daftarUsulan(t.id)).toEqual([]);
    }
    expect(await riwayatJadwal(lain.id)).toEqual([]);
    expect(kepala.dimuatUlang).toEqual([
      `/admin/jadwal-toko/${cibubur}`,
      `/pengiriman-gudang/${cibubur}`,
      `/usulan-jadwal/${cibubur}`,
      "/admin/jadwal",
    ]);
  });

  // T144 — PRD A5 ▶ Keputusan 2026-10-27: Salin jadwal menerapkan pilihan Tambah 3 hari cakupan ke setiap toko terpilih,
  // dengan aturan versi yang sama.
  it("dengan Tambah 3 hari cakupan dicentang → setiap toko terpilih bertanda; toko yang jadwalnya sudah sama tidak mendapat versi baru", async () => {
    await masukAdmin();
    const [a, b] = [await tokoDiGudang(cibubur), await tokoDiGudang(cibubur)];
    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: b.id, ...pengaturan, tambah3HariCakupan: true })).resolves.toEqual({
      keadaan: "berhasil",
    });
    const [jadwalB] = await riwayatJadwal(b.id);

    await expect(
      salinJadwalTetap({ idGudang: cibubur, daftarIdToko: [a.id, b.id], ...pengaturan, tambah3HariCakupan: true }),
    ).resolves.toEqual({
      keadaan: "berhasil",
      hasil: [
        { idToko: a.id, status: "berhasil" },
        { idToko: b.id, status: "berhasil" },
      ],
    });
    expect(await riwayatJadwal(a.id)).toMatchObject([{ status: "aktif", pola: "2x-seminggu", tambah3HariCakupan: true }]);
    expect(await riwayatJadwal(b.id)).toEqual([jadwalB]);
    const aktif = new Map((await jadwalTokoGudang(cibubur)).map((t) => [t.id, t.jadwal]));
    expect([aktif.get(a.id)?.tambah3HariCakupan, aktif.get(b.id)?.tambah3HariCakupan]).toEqual([true, true]);
  });

  it("tanpa toko terpilih → gagal tanpa menulis", async () => {
    await masukAdmin();
    await expect(salinJadwalTetap({ idGudang: cibubur, daftarIdToko: [], ...pengaturan })).resolves.toEqual({
      keadaan: "gagal",
      pesan: "Pilih minimal satu toko.",
    });
  });

  it("pengaturan tidak valid → setiap toko ditolak validasi, tidak ada yang dimuat ulang", async () => {
    await masukAdmin();
    const [a, b] = [await tokoDiGudang(cibubur), await tokoDiGudang(cibubur)];
    const pesan = "Pola dua mingguan membutuhkan minimal 1 hari kirim, dipilih 0.";
    await expect(salinJadwalTetap({ idGudang: cibubur, daftarIdToko: [a.id, b.id], pola: "dua-mingguan", hariKirim: [] })).resolves.toEqual(
      {
        keadaan: "berhasil",
        hasil: [
          { idToko: a.id, status: "ditolak", pesan },
          { idToko: b.id, status: "ditolak", pesan },
        ],
      },
    );
    expect(kepala.dimuatUlang).toEqual([]);
  });

  it("galat tak terduga pada satu toko → belum pasti untuk toko itu, toko lain tetap diproses", async () => {
    const idPengguna = (await buatPenggunaUji("admin")).id;
    const [a, b] = [await tokoDiGudang(bali), await tokoDiGudang(bali)];
    // Id di luar rentang integer PostgreSQL membuat kueri toko itu gagal.
    const idRusak = 2 ** 40;
    const hasil = await salinJadwalKeToko({
      idGudang: bali,
      daftarIdToko: [a.id, idRusak, b.id, a.id],
      masukan: pengaturan,
      idPengguna,
      hariIni: parseTanggalBisnis("2026-10-15"),
    });
    expect(hasil).toEqual([
      { idToko: a.id, status: "berhasil" },
      { idToko: idRusak, status: "belumPasti", pesan: expect.stringContaining("belum pasti") },
      { idToko: b.id, status: "berhasil" },
    ]);
  });
});

describe("kewenangan: hanya admin", () => {
  it("operator berhak jadwal dan viewer ditolak di server sebelum menulis", async () => {
    const t = await tokoDiGudang(pusat);
    const operator = await kepalaPenggunaUji("viewer");
    await tugaskanOperator({ idPengguna: operator.id, idGudang: pusat, hakTindakan: ["kelola-usulan-jadwal"] });
    const viewer = await kepalaPenggunaUji("viewer");

    for (const cookie of [operator.cookie, viewer.cookie]) {
      kepala.cookie = cookie;
      await expect(aturJadwalTetapToko({ idGudang: pusat, idToko: t.id, ...pengaturan })).rejects.toBeInstanceOf(AksesDitolakError);
      await expect(nonaktifkanJadwalTetapToko({ idGudang: pusat, idToko: t.id })).rejects.toBeInstanceOf(AksesDitolakError);
      await expect(salinJadwalTetap({ idGudang: pusat, daftarIdToko: [t.id], ...pengaturan })).rejects.toBeInstanceOf(AksesDitolakError);
      // T144: mencentang Tambah 3 hari cakupan juga hanya untuk admin.
      await expect(aturJadwalTetapToko({ idGudang: pusat, idToko: t.id, ...pengaturan, tambah3HariCakupan: true })).rejects.toBeInstanceOf(
        AksesDitolakError,
      );
      await expect(
        salinJadwalTetap({ idGudang: pusat, daftarIdToko: [t.id], ...pengaturan, tambah3HariCakupan: true }),
      ).rejects.toBeInstanceOf(AksesDitolakError);
    }
    expect(await riwayatJadwal(t.id)).toEqual([]);
  });
});

// T113 — PRD A5 ▶ Revisi 2026-10-13, Pembatalan otomatis: pengiriman di luar jadwal yang belum lewat dan belum final ikut
// dibatalkan sistem saat admin menonaktifkan atau mengubah jadwal tetap. Hari ini tetap Kamis 2026-10-15 (WIB).
describe("pembatalan otomatis pengiriman di luar jadwal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-15T09:00:00+07:00") });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** 2× seminggu Senin (H) + Kamis (H−1), seperti BOTANI. */
  const botani = {
    pola: "2x-seminggu",
    hariKirim: [
      { hari: "Senin", persiapan: "H" },
      { hari: "Kamis", persiapan: "H-1" },
    ],
  } as const;

  async function tokoBotani() {
    const t = await tokoDiGudang(cibubur);
    const admin = await masukAdmin();
    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...botani })).resolves.toEqual({ keadaan: "berhasil" });
    return { toko: t, admin };
  }

  async function pengiriman(idToko: number, idPengguna: string, isian: Partial<typeof pengirimanDiLuarJadwal.$inferInsert>) {
    const [p] = await db
      .insert(pengirimanDiLuarJadwal)
      .values({
        gudangId: cibubur,
        tokoId: idToko,
        jenis: "tambahan",
        tanggalKirim: "2026-10-20",
        persiapanHari: 1,
        alasan: "uji",
        diusulkanOleh: idPengguna,
        status: "berlaku",
        diputuskanOleh: idPengguna,
        diputuskanPada: new Date(),
        ...isian,
      })
      .returning();
    return p.id;
  }

  const baca = async (id: number) => (await db.select().from(pengirimanDiLuarJadwal).where(eq(pengirimanDiLuarJadwal.id, id)))[0];

  it("menonaktifkan jadwal tetap → pengiriman menunggu dan berlaku yang belum lewat dan belum final Dibatalkan", async () => {
    const { toko: t, admin } = await tokoBotani();
    const berlaku = await pengiriman(t.id, admin.id, {});
    const menunggu = await pengiriman(t.id, admin.id, {
      tanggalKirim: "2026-10-21",
      status: "menunggu",
      diputuskanOleh: null,
      diputuskanPada: null,
    });
    const lewat = await pengiriman(t.id, admin.id, { tanggalKirim: "2026-10-14" });
    const final = await pengiriman(t.id, admin.id, { tanggalKirim: "2026-10-23" });
    await rencanaFinalUji({ idGudang: cibubur, idToko: t.id, tanggalKirim: "2026-10-23", idPengguna: admin.id });

    await expect(nonaktifkanJadwalTetapToko({ idGudang: cibubur, idToko: t.id })).resolves.toEqual({ keadaan: "berhasil" });

    for (const id of [berlaku, menunggu]) {
      const p = await baca(id);
      expect(p).toMatchObject({ status: "dibatalkan", alasanPembatalan: "Jadwal tetap dinonaktifkan", dibatalkanOleh: null });
      expect(p.dibatalkanPada).toBeInstanceOf(Date);
    }
    expect((await baca(lewat)).status).toBe("berlaku");
    expect((await baca(final)).status).toBe("berlaku");
  });

  it('mengubah jadwal tetap sehingga tanggal rutin yang dipindah hilang → Dibatalkan, alasan "Jadwal tetap berubah"', async () => {
    const { toko: t, admin } = await tokoBotani();
    const pindah = await pengiriman(t.id, admin.id, {
      jenis: "pindah",
      tanggalRutinDipindah: "2026-10-19",
      tanggalKirim: "2026-10-20",
      persiapanHari: 0,
    });
    const tambahan = await pengiriman(t.id, admin.id, { tanggalKirim: "2026-10-24" });

    // Senin tidak lagi hari kirim: Rabu (H) + Kamis (H−1).
    const baru = {
      ...botani,
      hariKirim: [
        { hari: "Rabu", persiapan: "H" },
        { hari: "Kamis", persiapan: "H-1" },
      ],
    } as const;
    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...baru })).resolves.toEqual({ keadaan: "berhasil" });

    expect(await baca(pindah)).toMatchObject({ status: "dibatalkan", alasanPembatalan: "Jadwal tetap berubah", dibatalkanOleh: null });
    // Sabtu 24-10 tetap bukan tanggal rutin: tidak terdampak.
    expect((await baca(tambahan)).status).toBe("berlaku");
  });

  it('mengubah jadwal tetap sehingga tanggal tambahan menjadi tanggal rutin → Dibatalkan, alasan "Tanggal itu sudah menjadi tanggal kirim rutin"', async () => {
    const { toko: t, admin } = await tokoBotani();
    const tambahan = await pengiriman(t.id, admin.id, {});

    // Selasa menjadi hari kirim rutin: Senin (H) + Selasa (H−1).
    const baru = {
      ...botani,
      hariKirim: [
        { hari: "Senin", persiapan: "H" },
        { hari: "Selasa", persiapan: "H-1" },
      ],
    } as const;
    await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...baru })).resolves.toEqual({ keadaan: "berhasil" });

    expect(await baca(tambahan)).toMatchObject({
      status: "dibatalkan",
      alasanPembatalan: "Tanggal itu sudah menjadi tanggal kirim rutin",
      dibatalkanOleh: null,
    });
  });

  // T144 — PRD A5 ▶ Keputusan 2026-10-27 (Perubahan dan peralihan): tanggal kirim toko tidak berubah, jadi tidak ada yang
  // dibatalkan.
  it("hanya Tambah 3 hari cakupan yang dicentang lalu dilepas → pengiriman di luar jadwal tetap Menunggu atau Berlaku", async () => {
    const { toko: t, admin } = await tokoBotani();
    const berlaku = await pengiriman(t.id, admin.id, {});
    const menunggu = await pengiriman(t.id, admin.id, {
      tanggalKirim: "2026-10-21",
      status: "menunggu",
      diputuskanOleh: null,
      diputuskanPada: null,
    });
    const pindah = await pengiriman(t.id, admin.id, {
      jenis: "pindah",
      tanggalRutinDipindah: "2026-10-22",
      tanggalKirim: "2026-10-23",
    });

    for (const tambah3HariCakupan of [true, false]) {
      await expect(aturJadwalTetapToko({ idGudang: cibubur, idToko: t.id, ...botani, tambah3HariCakupan })).resolves.toEqual({
        keadaan: "berhasil",
      });
      expect(await riwayatJadwal(t.id)).toHaveLength(tambah3HariCakupan ? 2 : 3);
      expect([(await baca(berlaku)).status, (await baca(menunggu)).status, (await baca(pindah)).status]).toEqual([
        "berlaku",
        "menunggu",
        "berlaku",
      ]);
    }
  });
});
