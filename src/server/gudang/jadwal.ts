import { and, asc, desc, eq, gte, inArray, isNotNull, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { periksaJadwal, tanggalKirimMenurutJadwal, type Jadwal, type MasukanJadwal } from "@/domain/jadwal";
import { parseTanggalBisnis, type TanggalBisnis } from "@/domain/kalender";
import { validasiTokoAcuan } from "@/domain/toko-acuan";
import { db } from "@/server/db";
import { gudang, hubunganTokoGudang, jadwalToko, pengirimanDiLuarJadwal, rencanaFinal, toko, user } from "@/server/db/schema";

import { daftarHariKirim } from "./pilihan-jadwal";

// Jadwal tetap toko (T55; T112, PRD A5 ▶ Revisi 2026-10-13): setiap toko paling banyak satu jadwal tetap aktif, diatur
// admin dan langsung berlaku. Alur usulan jadwal tetap oleh operator dan jalur langsung Pusat dihapus (T113).
// Kewenangan diperiksa pemanggil (server action). Kolom `tanggal_jangkar` hanya tersisa untuk data lama: tidak dibaca dan
// tidak diisi (PRD A5 ▶ Revisi 2026-10-19, T135). Jadwal tetap juga bisa memakai toko acuan (PRD A5 ▶ Keputusan
// 2026-11-04, T149): toko acuan bagian dari versi jadwal, jadi mengubahnya membuat versi baru.

/** Toko acuan jadwal tetap (PRD A5 ▶ Keputusan 2026-11-04, T149), dengan nama toko saat ini. */
export type TokoAcuan = { id: number; nama: string };

/** Toko acuan siap tampil dari kolom hasil join; tidak ada = tanpa toko acuan (properti tidak diisi). */
export function tokoAcuanDari(id: number | null, nama: string | null): { tokoAcuan?: TokoAcuan } {
  return id === null || nama === null ? {} : { tokoAcuan: { id, nama } };
}

/** Jadwal aktif satu toko, siap tampil. */
type JadwalAktif = Jadwal & {
  /**
   * Versi jadwal toko = id jadwal aktif. Berubah setiap kali jadwal toko dibuat atau diubah; toko tanpa jadwal aktif
   * (belum dibuat atau dinonaktifkan) tidak punya versi. Hasil yang menyimpan versi ini bisa dibandingkan dengan versi
   * saat ini untuk tahu apakah jadwalnya sudah berubah (sinyal untuk T61).
   */
  versi: number;
  diaturOleh: string;
  diaturPada: Date;
  /** Toko acuan jadwal tetap ini (T149); tidak ada = tanpa toko acuan. */
  tokoAcuan?: TokoAcuan;
};

export type TokoDenganJadwal = { id: number; nama: string; aktif: boolean; jadwal: JadwalAktif | null };

/** Toko yang terhubung ke gudang `idGudang` (urut nama) beserta jadwal aktifnya. Pemeriksaan akses oleh pemanggil. */
export async function jadwalTokoGudang(idGudang: number, klien: typeof db | Tx = db): Promise<TokoDenganJadwal[]> {
  const acuan = alias(toko, "toko_acuan");
  const baris = await klien
    .select({
      id: toko.id,
      nama: toko.nama,
      aktif: toko.aktif,
      versi: jadwalToko.id,
      pola: jadwalToko.pola,
      hariKirim: jadwalToko.hariKirim,
      tambah3HariCakupan: jadwalToko.tambah3HariCakupan,
      idTokoAcuan: acuan.id,
      namaTokoAcuan: acuan.nama,
      diaturOleh: user.name,
      diaturPada: jadwalToko.dibuatPada,
    })
    .from(hubunganTokoGudang)
    .innerJoin(toko, eq(toko.id, hubunganTokoGudang.tokoId))
    .leftJoin(jadwalToko, and(eq(jadwalToko.tokoId, toko.id), eq(jadwalToko.status, "aktif")))
    .leftJoin(acuan, eq(acuan.id, jadwalToko.tokoAcuanId))
    .leftJoin(user, eq(user.id, jadwalToko.dibuatOleh))
    .where(eq(hubunganTokoGudang.gudangId, idGudang))
    .orderBy(asc(toko.nama));

  return baris.map((b) => ({
    id: b.id,
    nama: b.nama,
    aktif: b.aktif,
    jadwal:
      b.versi === null ||
      b.pola === null ||
      b.hariKirim === null ||
      b.tambah3HariCakupan === null ||
      b.diaturOleh === null ||
      b.diaturPada === null
        ? null
        : {
            versi: b.versi,
            pola: b.pola,
            hariKirim: b.hariKirim,
            tambah3HariCakupan: b.tambah3HariCakupan,
            diaturOleh: b.diaturOleh,
            diaturPada: b.diaturPada,
            ...tokoAcuanDari(b.idTokoAcuan, b.namaTokoAcuan),
          },
  }));
}

export type HasilJadwal = { keadaan: "berhasil" } | { keadaan: "gagal"; pesan: string };

const PESAN_TOKO_TIDAK_TERHUBUNG = "Toko tidak terhubung ke gudang ini. Muat ulang halaman, lalu pilih lagi.";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Memastikan gudang ada dan toko terhubung ke gudang itu, lalu mengunci baris toko agar perubahan jadwal bersamaan untuk
 * toko yang sama berjalan bergantian. `null` = boleh lanjut.
 */
export async function periksaTujuan(tx: Tx, { idGudang, idToko }: { idGudang: number; idToko: number }): Promise<string | null> {
  const [tujuan] = await tx.select({ id: gudang.id }).from(gudang).where(eq(gudang.id, idGudang));
  if (!tujuan) return "Gudang tidak ditemukan.";

  const [terhubung] = await tx
    .select({ idToko: toko.id })
    .from(hubunganTokoGudang)
    .innerJoin(toko, eq(toko.id, hubunganTokoGudang.tokoId))
    .where(and(eq(hubunganTokoGudang.tokoId, idToko), eq(hubunganTokoGudang.gudangId, idGudang)))
    .for("update", { of: toko });
  return terhubung ? null : PESAN_TOKO_TIDAK_TERHUBUNG;
}

/** Hari kirim dalam urutan Senin–Minggu, supaya jadwal yang sama selalu tersimpan dengan bentuk yang sama. */
function urutkanHari(hariKirim: Jadwal["hariKirim"]): Jadwal["hariKirim"] {
  return [...hariKirim].sort((a, b) => daftarHariKirim.indexOf(a.hari) - daftarHariKirim.indexOf(b.hari));
}

/** Memvalidasi isian dengan `periksaJadwal` (T54); jadwal yang valid dikembalikan dengan hari kirim terurut. */
export function jadwalDariMasukan(masukan: MasukanJadwal): { jadwal: Jadwal } | { pesan: string } {
  const hasil = periksaJadwal(masukan);
  if (hasil.keadaan === "tidakValid") return { pesan: hasil.pesan.join(" ") };
  return { jadwal: { ...hasil.jadwal, hariKirim: urutkanHari(hasil.jadwal.hariKirim) } };
}

/** Jadwal tetap seperti tersimpan: jadwal beserta id toko acuannya (`null` = tanpa toko acuan, T149). */
type JadwalTersimpan = Jadwal & { idTokoAcuan: number | null };

/**
 * Pola, hari kirim, persiapan, pilihan "Tambah 3 hari cakupan" (PRD A5 ▶ Keputusan 2026-10-27, T144), dan toko acuan
 * (PRD A5 ▶ Keputusan 2026-11-04, T149) sama. Tanggal jangkar versi lama diabaikan, jadi menyimpan ulang jadwal dua
 * mingguan lama tanpa perubahan tidak membuat versi baru (PRD A5 ▶ Revisi 2026-10-19, Peralihan).
 */
function jadwalSama(a: JadwalTersimpan, b: JadwalTersimpan) {
  return (
    a.pola === b.pola &&
    JSON.stringify(a.hariKirim) === JSON.stringify(b.hariKirim) &&
    (a.tambah3HariCakupan === true) === (b.tambah3HariCakupan === true) &&
    a.idTokoAcuan === b.idTokoAcuan
  );
}

/** Jadwal aktif satu toko di dalam transaksi, atau `null`. */
export async function bacaJadwalAktif(tx: Tx, idToko: number): Promise<(JadwalTersimpan & { id: number }) | null> {
  const [aktif] = await tx
    .select({
      id: jadwalToko.id,
      pola: jadwalToko.pola,
      hariKirim: jadwalToko.hariKirim,
      tambah3HariCakupan: jadwalToko.tambah3HariCakupan,
      idTokoAcuan: jadwalToko.tokoAcuanId,
    })
    .from(jadwalToko)
    .where(and(eq(jadwalToko.tokoId, idToko), eq(jadwalToko.status, "aktif")));
  return aktif ?? null;
}

/**
 * Menjadikan `baru` jadwal aktif toko. Jadwal aktif lama
 * dinonaktifkan atas nama `idPengguna` dan tetap tersimpan sebagai riwayat. Jadwal yang sama dengan jadwal aktif tidak
 * membuat versi baru. Jadwal baru disimpan tanpa tanggal jangkar (T135), beserta pilihan "Tambah 3 hari cakupan" (T144)
 * dan toko acuan (T149). `baru.idTokoAcuan` tidak diisi = toko acuan jadwal aktif dipertahankan (Salin jadwal belum
 * mengatur toko acuan, T150); toko acuan yang diisi sudah diperiksa `periksaTokoAcuan`. Harus dipanggil di dalam transaksi
 * setelah `periksaTujuan` mengunci toko.
 */
export async function gantiJadwalAktif(
  tx: Tx,
  { idToko, baru, idPengguna }: { idToko: number; baru: Jadwal & { idTokoAcuan?: number | null }; idPengguna: string },
) {
  const lama = await bacaJadwalAktif(tx, idToko);
  const idTokoAcuan = baru.idTokoAcuan === undefined ? (lama?.idTokoAcuan ?? null) : baru.idTokoAcuan;
  if (lama) {
    if (jadwalSama(lama, { ...baru, idTokoAcuan })) return;
    await tx
      .update(jadwalToko)
      .set({ status: "nonaktif", dinonaktifkanOleh: idPengguna, dinonaktifkanPada: sql`now()` })
      .where(eq(jadwalToko.id, lama.id));
  }
  await tx.insert(jadwalToko).values({
    tokoId: idToko,
    pola: baru.pola,
    hariKirim: [...baru.hariKirim],
    tambah3HariCakupan: baru.tambah3HariCakupan === true,
    tokoAcuanId: idTokoAcuan,
    dibuatOleh: idPengguna,
  });
}

/** Kunci advisory: pengisian toko acuan berjalan bergiliran agar pemeriksaan "tidak berantai" tidak balapan. */
const KUNCI_TOKO_ACUAN = 149;

const PESAN_TOKO_ACUAN_TIDAK_DITEMUKAN = "Toko acuan tidak ditemukan. Muat ulang halaman, lalu pilih lagi.";

/** Toko yang jadwal tetap aktifnya memakai toko acuan (`toko.id` dari kueri luar). */
const memakaiTokoAcuan = (klien: typeof db | Tx) =>
  klien
    .select({ id: jadwalToko.id })
    .from(jadwalToko)
    .where(and(eq(jadwalToko.tokoId, toko.id), eq(jadwalToko.status, "aktif"), isNotNull(jadwalToko.tokoAcuanId)));

/**
 * Memeriksa ulang toko acuan `idTokoAcuan` untuk toko `idToko` saat menyimpan (PRD A5 ▶ Keputusan 2026-11-04, "Saat
 * menyimpan") dengan `validasiTokoAcuan`, dari data saat ini: status toko acuan, apakah jadwal tetap aktifnya memakai toko
 * acuan, dan toko lain yang jadwal tetap aktifnya memakai toko ini (urut nama). `null` = boleh disimpan. Dipanggil di
 * dalam transaksi penyimpanannya; pemeriksaan dan penyimpanan toko acuan berjalan bergiliran (kunci advisory).
 */
async function periksaTokoAcuan(tx: Tx, { idToko, idTokoAcuan }: { idToko: number; idTokoAcuan: number }): Promise<string | null> {
  await tx.execute(sql`select pg_advisory_xact_lock(${KUNCI_TOKO_ACUAN}, 0)`);
  const [acuan] = await tx
    .select({ nama: toko.nama, aktif: toko.aktif, memakaiTokoAcuan: sql<boolean>`exists (${memakaiTokoAcuan(tx)})` })
    .from(toko)
    .where(eq(toko.id, idTokoAcuan));
  if (!acuan) return PESAN_TOKO_ACUAN_TIDAK_DITEMUKAN;
  const [ini] = await tx.select({ nama: toko.nama }).from(toko).where(eq(toko.id, idToko));
  const peminjam = await tx
    .select({ nama: toko.nama })
    .from(jadwalToko)
    .innerJoin(toko, eq(toko.id, jadwalToko.tokoId))
    .where(and(eq(jadwalToko.tokoAcuanId, idToko), eq(jadwalToko.status, "aktif")))
    .orderBy(asc(toko.nama));

  const hasil = validasiTokoAcuan({
    toko: ini.nama,
    tokoAcuan: acuan,
    dipakaiSebagaiAcuanOleh: peminjam.map((p) => p.nama),
  });
  return hasil.hasil === "ditolak" ? hasil.pesan : null;
}

/**
 * Pilihan toko acuan di form jadwal tetap (PRD A5 ▶ Keputusan 2026-11-04, Pengaturan): toko aktif dari gudang mana pun
 * atau yang belum terhubung ke gudang, tanpa toko yang jadwal tetap aktifnya memakai toko acuan, urut nama. Toko itu
 * sendiri disaring form. Pemeriksaan akses oleh pemanggil.
 */
export async function pilihanTokoAcuan(): Promise<TokoAcuan[]> {
  return db
    .select({ id: toko.id, nama: toko.nama })
    .from(toko)
    .where(and(eq(toko.aktif, true), notExists(memakaiTokoAcuan(db))))
    .orderBy(asc(toko.nama));
}

/** Menonaktifkan jadwal aktif toko atas nama `idPengguna`. `false` = toko tidak punya jadwal aktif. */
export async function nonaktifkanJadwalAktif(tx: Tx, { idToko, idPengguna }: { idToko: number; idPengguna: string }) {
  const baris = await tx
    .update(jadwalToko)
    .set({ status: "nonaktif", dinonaktifkanOleh: idPengguna, dinonaktifkanPada: sql`now()` })
    .where(and(eq(jadwalToko.tokoId, idToko), eq(jadwalToko.status, "aktif")))
    .returning({ id: jadwalToko.id });
  return baris.length > 0;
}

const PESAN_TANPA_JADWAL_AKTIF = "Toko ini tidak punya jadwal aktif. Muat ulang halaman untuk melihat jadwal terbaru.";

const ALASAN_JADWAL_DINONAKTIFKAN = "Jadwal tetap dinonaktifkan";
const ALASAN_JADWAL_BERUBAH = "Jadwal tetap berubah";
const ALASAN_SUDAH_RUTIN = "Tanggal itu sudah menjadi tanggal kirim rutin";

/**
 * Pengiriman di luar jadwal yang terkena pembatalan otomatis oleh sistem (PRD A5 ▶ Revisi 2026-10-13): menunggu atau
 * berlaku, tanggal kirimnya belum lewat (`hariIni` atau sesudahnya), dan belum punya rencana final toko itu untuk tanggal
 * tersebut.
 */
export function bisaDibatalkanOtomatis(hariIni: TanggalBisnis) {
  return and(
    inArray(pengirimanDiLuarJadwal.status, ["menunggu", "berlaku"]),
    gte(pengirimanDiLuarJadwal.tanggalKirim, hariIni),
    sql`not exists (select 1 from ${rencanaFinal} where ${rencanaFinal.tokoId} = ${pengirimanDiLuarJadwal.tokoId} and ${rencanaFinal.tanggalKirim} = ${pengirimanDiLuarJadwal.tanggalKirim})`,
  );
}

/**
 * Pembatalan otomatis oleh sistem (T113, PRD A5 ▶ Revisi 2026-10-13) untuk pengiriman di luar jadwal toko yang
 * `bisaDibatalkanOtomatis`. Setelah jadwal tetap toko diubah (`jadwal` = jadwal tetap baru), hanya yang tidak lagi sesuai
 * yang dibatalkan, dengan alasannya masing-masing. Dengan `alasan` (jadwal tetap dinonaktifkan, atau toko dilepas dari
 * gudang, T115), semuanya dibatalkan dengan alasan itu. Pembatal kosong = sistem. Dipanggil di dalam transaksi
 * perubahannya, setelah baris toko dikunci.
 */
export async function batalkanPengirimanDiLuarJadwalTerdampak(
  tx: Tx,
  { idToko, hariIni, ...perubahan }: { idToko: number; hariIni: TanggalBisnis } & ({ jadwal: Jadwal } | { alasan: string }),
) {
  const terdampak = await tx
    .select({
      id: pengirimanDiLuarJadwal.id,
      tanggalKirim: pengirimanDiLuarJadwal.tanggalKirim,
      tanggalRutinDipindah: pengirimanDiLuarJadwal.tanggalRutinDipindah,
    })
    .from(pengirimanDiLuarJadwal)
    .where(and(eq(pengirimanDiLuarJadwal.tokoId, idToko), bisaDibatalkanOtomatis(hariIni)));

  const alasanUntuk = (p: (typeof terdampak)[number]): string | null => {
    if ("alasan" in perubahan) return perubahan.alasan;
    const rutin = (tanggal: string) => tanggalKirimMenurutJadwal(perubahan.jadwal, parseTanggalBisnis(tanggal)).kirim;
    if (p.tanggalRutinDipindah !== null && !rutin(p.tanggalRutinDipindah)) return ALASAN_JADWAL_BERUBAH;
    if (rutin(p.tanggalKirim)) return ALASAN_SUDAH_RUTIN;
    return null;
  };
  for (const p of terdampak) {
    const alasan = alasanUntuk(p);
    if (alasan === null) continue;
    await tx
      .update(pengirimanDiLuarJadwal)
      .set({ status: "dibatalkan", alasanPembatalan: alasan, dibatalkanPada: sql`now()` })
      .where(eq(pengirimanDiLuarJadwal.id, p.id));
  }
}

// Jadwal tetap diatur admin (T112, PRD A5 ▶ Revisi 2026-10-13): admin membuat, mengubah, dan menonaktifkan jadwal tetap
// toko di semua gudang termasuk Pusat, langsung berlaku tanpa usulan. Versi jadwal berganti sehingga draft terdampak
// tetap ditandai. Pengiriman di luar jadwal toko itu yang tidak lagi sesuai dibatalkan otomatis dalam transaksi yang sama
// (T113). Peran admin diperiksa pemanggil (server action). `hariIni` = tanggal saat ini (WIB).

/**
 * Menyimpan jadwal tetap satu toko atas nama admin `idPengguna`. Toko harus terhubung ke gudang `idGudang`. Toko acuan
 * (T149): `null` = tanpa toko acuan, id = diperiksa ulang `periksaTokoAcuan`, tidak diisi = toko acuan jadwal aktif tidak
 * diubah (Salin jadwal). Mengubah toko acuan saja tidak mengubah tanggal kirim toko, jadi tidak ada pengiriman di luar
 * jadwal yang dibatalkan karenanya.
 */
export async function aturJadwalTetap({
  idGudang,
  idToko,
  masukan,
  idTokoAcuan,
  idPengguna,
  hariIni,
}: {
  idGudang: number;
  idToko: number;
  masukan: MasukanJadwal;
  idTokoAcuan?: number | null;
  idPengguna: string;
  hariIni: TanggalBisnis;
}): Promise<HasilJadwal> {
  const hasil = jadwalDariMasukan(masukan);

  return db.transaction(async (tx) => {
    const pesanTujuan = await periksaTujuan(tx, { idGudang, idToko });
    if (pesanTujuan !== null) return { keadaan: "gagal", pesan: pesanTujuan };
    if ("pesan" in hasil) return { keadaan: "gagal", pesan: hasil.pesan };
    if (idTokoAcuan !== undefined && idTokoAcuan !== null) {
      const pesanTokoAcuan = await periksaTokoAcuan(tx, { idToko, idTokoAcuan });
      if (pesanTokoAcuan !== null) return { keadaan: "gagal", pesan: pesanTokoAcuan };
    }

    await gantiJadwalAktif(tx, { idToko, baru: { ...hasil.jadwal, idTokoAcuan }, idPengguna });
    await batalkanPengirimanDiLuarJadwalTerdampak(tx, { idToko, jadwal: hasil.jadwal, hariIni });
    return { keadaan: "berhasil" };
  });
}

/** Menonaktifkan jadwal tetap satu toko atas nama admin `idPengguna`. Riwayat tidak dihapus. */
export async function nonaktifkanJadwalTetap({
  idGudang,
  idToko,
  idPengguna,
  hariIni,
}: {
  idGudang: number;
  idToko: number;
  idPengguna: string;
  hariIni: TanggalBisnis;
}): Promise<HasilJadwal> {
  return db.transaction(async (tx) => {
    const pesanTujuan = await periksaTujuan(tx, { idGudang, idToko });
    if (pesanTujuan !== null) return { keadaan: "gagal", pesan: pesanTujuan };

    if (!(await nonaktifkanJadwalAktif(tx, { idToko, idPengguna }))) {
      return { keadaan: "gagal", pesan: PESAN_TANPA_JADWAL_AKTIF };
    }
    await batalkanPengirimanDiLuarJadwalTerdampak(tx, { idToko, alasan: ALASAN_JADWAL_DINONAKTIFKAN, hariIni });
    return { keadaan: "berhasil" };
  });
}

/**
 * Satu baris riwayat jadwal tetap toko, beserta pilihan "Tambah 3 hari cakupan"-nya (T144) dan toko acuannya (T149; tidak
 * ada = tanpa toko acuan). `berakhir` null = masih aktif.
 */
export type EntriRiwayatJadwal = Jadwal & {
  id: number;
  tambah3HariCakupan: boolean;
  tokoAcuan?: TokoAcuan;
  diaturOleh: string;
  diaturPada: Date;
  berakhir: { jenis: "diganti" | "dinonaktifkan"; oleh: string; pada: Date } | null;
};

/**
 * Riwayat jadwal tetap setiap toko yang terhubung ke gudang `idGudang`: semua baris `jadwal_toko`, terbaru di atas.
 * Jadwal yang diganti dan penggantinya ditulis dalam satu transaksi (`gantiJadwalAktif`), jadi waktu nonaktifnya sama
 * dengan waktu dibuat jadwal berikutnya; selain itu jadwal itu dinonaktifkan. Pemeriksaan akses oleh pemanggil.
 */
export async function riwayatJadwalTetapGudang(idGudang: number): Promise<Map<number, EntriRiwayatJadwal[]>> {
  const pengatur = alias(user, "pengatur");
  const penonaktif = alias(user, "penonaktif");
  const acuan = alias(toko, "toko_acuan");
  const baris = await db
    .select({
      id: jadwalToko.id,
      idToko: jadwalToko.tokoId,
      pola: jadwalToko.pola,
      hariKirim: jadwalToko.hariKirim,
      tambah3HariCakupan: jadwalToko.tambah3HariCakupan,
      idTokoAcuan: acuan.id,
      namaTokoAcuan: acuan.nama,
      diaturOleh: pengatur.name,
      diaturPada: jadwalToko.dibuatPada,
      dinonaktifkanOleh: penonaktif.name,
      dinonaktifkanPada: jadwalToko.dinonaktifkanPada,
    })
    .from(hubunganTokoGudang)
    .innerJoin(jadwalToko, eq(jadwalToko.tokoId, hubunganTokoGudang.tokoId))
    .innerJoin(pengatur, eq(pengatur.id, jadwalToko.dibuatOleh))
    .leftJoin(penonaktif, eq(penonaktif.id, jadwalToko.dinonaktifkanOleh))
    .leftJoin(acuan, eq(acuan.id, jadwalToko.tokoAcuanId))
    .where(eq(hubunganTokoGudang.gudangId, idGudang))
    .orderBy(asc(jadwalToko.tokoId), desc(jadwalToko.id));

  const riwayat = new Map<number, EntriRiwayatJadwal[]>();
  for (const b of baris) {
    const daftar = riwayat.get(b.idToko) ?? [];
    // Baris sebelumnya di daftar (terbaru di atas) adalah jadwal berikutnya toko ini.
    const berikutnya = daftar.at(-1);
    const berakhir =
      b.dinonaktifkanPada === null
        ? null
        : {
            jenis:
              berikutnya !== undefined && berikutnya.diaturPada.getTime() === b.dinonaktifkanPada.getTime()
                ? ("diganti" as const)
                : ("dinonaktifkan" as const),
            oleh: b.dinonaktifkanOleh ?? "—",
            pada: b.dinonaktifkanPada,
          };
    daftar.push({
      id: b.id,
      pola: b.pola,
      hariKirim: b.hariKirim,
      tambah3HariCakupan: b.tambah3HariCakupan,
      ...tokoAcuanDari(b.idTokoAcuan, b.namaTokoAcuan),
      diaturOleh: b.diaturOleh,
      diaturPada: b.diaturPada,
      berakhir,
    });
    riwayat.set(b.idToko, daftar);
  }
  return riwayat;
}
