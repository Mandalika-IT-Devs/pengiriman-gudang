import { eq, inArray } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { tanggalWib } from "@/app/admin/impor/format";
import { formatTanggal, parseTanggalBisnis } from "@/domain/kalender";
import { AksesDitolakError } from "@/server/auth/kewenangan";
import { buatPenggunaUji, kepalaPenggunaUji } from "@/server/auth/uji-bantu";
import { db } from "@/server/db";
import { draftRencana, hubunganTokoGudang, jadwalToko, pilihanDikirimPekanIni } from "@/server/db/schema";
import { PESAN_BUKAN_DUA_MINGGUAN_RUTIN } from "@/server/gudang/dikirim-pekan-ini";
import { hitungDraftRencana } from "@/server/gudang/draft-rencana";
import { daftarHakTindakan, type HakTindakan } from "@/server/gudang/hak-tindakan";
import { tugaskanOperator } from "@/server/gudang/penugasan";
import { siapkanTokoSmbUji } from "@/server/gudang/uji-bantu-cakupan";
import { buatGudangUji, buatTokoUji, hapusGudangUji, rencanaFinalUji } from "@/server/gudang/uji-bantu";

const kepala = vi.hoisted(() => ({ cookie: "", dimuatUlang: [] as string[] }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(kepala.cookie ? { cookie: kepala.cookie } : {}),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    kepala.dimuatUlang.push(path);
  },
}));
vi.mock("next/navigation", async (asli) => ({
  ...(await asli<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

import { ubahDikirimPekanIni } from "./aksi-dikirim-pekan-ini";
import HalamanPengirimanGudang from "./page";

// T134 (PRD A5 ▶ Revisi 2026-10-19, "Dikirim pekan ini"; DESIGN §7 ikon + teks): di draft, toko dua mingguan pada tanggal
// kirim rutinnya menampilkan kirim terakhir dan pilihan Dikirim / Tidak dikirim pekan ini. Pilihan diubah lewat server action
// dengan hak `finalisasi` (diperiksa di server); admin, viewer, dan operator tanpa hak itu hanya melihat. Toko Tidak dikirim
// pekan ini diberi penanda di ringkasan per toko dan kepala toko, tidak menampilkan form finalisasi, tetapi kebutuhan, stok,
// dan jumlah kirimnya tetap tampil dan stok tetap bisa diisi. Contoh BXC: dua mingguan Rabu (H−1), tanpa tanggal jangkar
// (T135: setiap Rabu tanggal kirim rutin), draft Rabu 28-10-2026.

const RABU_28 = parseTanggalBisnis("2026-10-28");

let idAdmin: string;
let gudang: { id: number; nama: string };
let gudangLain: { id: number; nama: string };
let bxc: { id: number; nama: string };
let kodeProduk: string;
let tokoMingguan: { id: number; nama: string };

beforeAll(async () => {
  idAdmin = (await buatPenggunaUji("admin")).id;
  [gudang, gudangLain] = [await buatGudangUji(), await buatGudangUji()];
  ({ toko: bxc, kodeProduk } = await siapkanTokoSmbUji({ idGudang: gudang.id, idAdmin }));
  await db
    .update(jadwalToko)
    .set({ pola: "dua-mingguan", hariKirim: [{ hari: "Rabu", persiapanHari: 1 }] })
    .where(eq(jadwalToko.tokoId, bxc.id));
  tokoMingguan = await buatTokoUji();
  await db.insert(hubunganTokoGudang).values({ tokoId: tokoMingguan.id, gudangId: gudang.id });
  await db
    .insert(jadwalToko)
    .values({ tokoId: tokoMingguan.id, pola: "mingguan", hariKirim: [{ hari: "Rabu", persiapanHari: 1 }], dibuatOleh: idAdmin });
  expect(await hitungDraftRencana({ idGudang: gudang.id, tanggalKirim: RABU_28, idPengguna: idAdmin })).toMatchObject({
    keadaan: "berhasil",
  });
}, 120_000);

afterAll(async () => {
  await db.delete(draftRencana).where(inArray(draftRencana.gudangId, [gudang.id, gudangLain.id]));
  await hapusGudangUji(gudang.id, gudangLain.id);
});

beforeEach(() => {
  kepala.cookie = "";
  kepala.dimuatUlang = [];
});

async function masukOperator(hakTindakan: HakTindakan[], idGudang = gudang.id) {
  const operator = await kepalaPenggunaUji("viewer");
  await tugaskanOperator({ idPengguna: operator.id, idGudang, hakTindakan });
  kepala.cookie = operator.cookie;
}

/** Draft Rabu 28-10-2026 dengan toko `tokoId` dibuka. */
const bukaToko = async (tokoId = bxc.id, tambahan: Record<string, string> = {}) =>
  renderToStaticMarkup(
    await HalamanPengirimanGudang({
      params: Promise.resolve({ id: String(gudang.id) }),
      searchParams: Promise.resolve({ tanggal: RABU_28, toko: String(tokoId), ...tambahan }),
    }),
  );

const ringkasan = (html: string, tokoId: number) => new RegExp(`<tr[^>]*data-ringkasan-toko="${tokoId}".*?</tr>`).exec(html)?.[0] ?? "";
const kepalaToko = (html: string) =>
  /<div[^>]*data-kepala-toko="[^"]*".*?<\/h4>.*?(?=<p class="text-muted-foreground">)/.exec(html)?.[0] ?? "";
const bagianPilihan = (html: string) => /<div[^>]*data-dikirim-pekan-ini="\d+".*?data-asal-pilihan[^>]*>.*?<\/p>/.exec(html)?.[0] ?? "";
const teks = (html: string) => html.replace(/<[^>]+>/g, "");
const pilihan = (dikirim: boolean) => ({ idGudang: gudang.id, tanggalKirim: RABU_28, tokoId: bxc.id, dikirim });
const pilihanTersimpan = () => db.select().from(pilihanDikirimPekanIni).where(eq(pilihanDikirimPekanIni.gudangId, gudang.id));

describe("draft: kirim terakhir dan pilihan Dikirim pekan ini", () => {
  it("belum ada rencana final sebelumnya: Dikirim otomatis, tanpa penanda; toko pola lain tanpa pilihan", async () => {
    await masukOperator(["finalisasi", "input-stok"]);
    const html = await bukaToko();
    const bagian = bagianPilihan(html);
    expect(teks(bagian)).toContain("Belum ada rencana final sebelumnya");
    expect(teks(bagian)).toContain("Otomatis dari kirim terakhir, belum dipilih operator.");
    expect(bagian).toMatch(/<input[^>]*data-pilihan-dikirim="ya"[^>]*checked=""/);
    expect(html).not.toContain("data-tidak-dikirim-pekan-ini");
    expect(html).not.toContain("data-finalisasi-tidak-dikirim");

    const mingguan = await bukaToko(tokoMingguan.id);
    expect(mingguan).toContain(`data-draft-toko="${tokoMingguan.id}"`);
    expect(mingguan).not.toContain("data-dikirim-pekan-ini=");
  });

  it("rencana final 21-10-2026 (gudang lain): Tidak dikirim pekan ini dengan penanda di ringkasan dan kepala toko; finalisasi diganti keterangan; stok tetap bisa diisi", async () => {
    await rencanaFinalUji({ idGudang: gudangLain.id, idToko: bxc.id, tanggalKirim: "2026-10-21", idPengguna: idAdmin });
    await masukOperator(["finalisasi", "input-stok"]);
    const html = await bukaToko();

    const penanda = /<span[^>]*data-tidak-dikirim-pekan-ini[^>]*>.*?<\/span>/;
    expect(ringkasan(html, bxc.id)).toMatch(penanda);
    expect(teks(ringkasan(html, bxc.id))).toContain("Tidak dikirim pekan ini");
    expect(ringkasan(html, bxc.id)).toContain("lucide-circle-minus");
    expect(ringkasan(html, tokoMingguan.id)).not.toContain("data-tidak-dikirim-pekan-ini");
    expect(kepalaToko(html)).toMatch(penanda);

    const bagian = bagianPilihan(html);
    expect(teks(bagian)).toContain("Kirim terakhir: Rabu, 21-10-2026 (7 hari sebelumnya)");
    expect(bagian).toMatch(/<input[^>]*data-pilihan-dikirim="tidak"[^>]*checked=""/);
    expect(bagian).toContain("Simpan pilihan");

    expect(html).toContain(`data-finalisasi-tidak-dikirim="${bxc.id}"`);
    expect(teks(html)).toContain(
      "Belum bisa difinalisasi: toko ini Tidak dikirim pekan ini. Ubah pilihan menjadi Dikirim untuk memfinalisasinya.",
    );
    expect(html).not.toContain(`data-finalisasi-tertahan="${bxc.id}"`);
    expect(html).not.toContain(`data-finalisasi-toko="${bxc.id}"`);

    // Kebutuhan, stok, dan jumlah kirim tetap tampil; stok tetap bisa diisi.
    expect(html).toMatch(new RegExp(`<tr[^>]*data-kode-produk="${kodeProduk}".*?data-kebutuhan="\\d+"`));
    expect(html).toMatch(new RegExp(`<input[^>]*aria-label="Stok akhir ${kodeProduk}"`));
  });

  it("admin, viewer gudang (tanpa hak), dan operator tanpa hak finalisasi hanya melihat pilihannya, tanpa form", async () => {
    for (const masuk of [
      async () => {
        kepala.cookie = (await kepalaPenggunaUji("admin")).cookie;
      },
      () => masukOperator([]),
      () => masukOperator(daftarHakTindakan.filter((h) => h !== "finalisasi")),
    ]) {
      await masuk();
      const html = await bukaToko();
      const bagian = bagianPilihan(html);
      expect(bagian).toMatch(/data-nilai-dikirim-pekan-ini="tidak"[^>]*>.*?Tidak dikirim pekan ini/);
      expect(teks(bagian)).toContain("Kirim terakhir: Rabu, 21-10-2026 (7 hari sebelumnya)");
      expect(html).not.toContain("data-form-dikirim-pekan-ini");
      expect(html).not.toContain('data-pilihan-dikirim="');
      expect(ringkasan(html, bxc.id)).toContain("data-tidak-dikirim-pekan-ini");
    }
  });
});

// T135 — PRD A5 ▶ Revisi 2026-10-19 (Cakupan): teks cakupan toko dua mingguan di draft dan rincian baris menyebut dua
// minggu; toko pola lain tetap "sampai sebelum kiriman berikutnya".
describe("draft: teks cakupan toko dua mingguan", () => {
  const teksTerbaca = (html: string) => html.replace(/<button[^>]*>.*?<\/button>/g, "").replace(/<[^>]+>/g, "");

  it("BXC: Cakupan 15 hari: persiapan 1 hari + 14 hari (dua minggu) di kepala toko dan rincian baris; toko mingguan tidak berubah", async () => {
    await masukOperator(["finalisasi", "input-stok"]);
    const html = await bukaToko(bxc.id, { rincian: `${bxc.id}|${kodeProduk}` });
    expect(html).toMatch(
      new RegExp(`data-draft-toko="${bxc.id}".*?data-teks-cakupan="Cakupan 15 hari: persiapan 1 hari \\+ 14 hari \\(dua minggu\\)"`),
    );
    const rincian = new RegExp(`<section[^>]*data-rincian-baris="${bxc.id}\\|${kodeProduk}".*?</section>`).exec(html)?.[0] ?? "";
    expect(teksTerbaca(rincian)).toContain(
      "Selasa, 27-10-2026 – Selasa, 10-11-2026 · Cakupan 15 hari: persiapan 1 hari + 14 hari (dua minggu)",
    );

    expect(await bukaToko(tokoMingguan.id)).toMatch(
      new RegExp(
        `data-draft-toko="${tokoMingguan.id}".*?data-teks-cakupan="Cakupan 8 hari: persiapan 1 hari \\+ 7 hari sampai sebelum kiriman berikutnya"`,
      ),
    );
  });
});

describe("server action ubahDikirimPekanIni: hak finalisasi diperiksa di server", () => {
  it("admin tanpa penugasan, viewer tanpa penugasan, operator tanpa hak finalisasi, dan hak finalisasi di gudang lain ditolak tanpa menyimpan", async () => {
    kepala.cookie = (await kepalaPenggunaUji("admin")).cookie;
    await expect(ubahDikirimPekanIni(pilihan(true))).rejects.toThrow(AksesDitolakError);
    kepala.cookie = (await kepalaPenggunaUji("viewer")).cookie;
    await expect(ubahDikirimPekanIni(pilihan(true))).rejects.toThrow(AksesDitolakError);
    await masukOperator(daftarHakTindakan.filter((h) => h !== "finalisasi"));
    await expect(ubahDikirimPekanIni(pilihan(true))).rejects.toThrow(AksesDitolakError);
    await masukOperator(["finalisasi"], gudangLain.id);
    await expect(ubahDikirimPekanIni(pilihan(true))).rejects.toThrow(AksesDitolakError);
    expect(await pilihanTersimpan()).toEqual([]);
    expect(kepala.dimuatUlang).toEqual([]);
  });

  it("isian tidak valid dan toko pola lain ditolak dengan pesan", async () => {
    await masukOperator(["finalisasi"]);
    expect(await ubahDikirimPekanIni({ ...pilihan(true), tanggalKirim: "2026-02-30" })).toEqual({
      keadaan: "gagal",
      pesan: "Tanggal kirim tidak valid.",
    });
    expect(await ubahDikirimPekanIni({ ...pilihan(true), tokoId: tokoMingguan.id })).toEqual({
      keadaan: "gagal",
      pesan: PESAN_BUKAN_DUA_MINGGUAN_RUTIN,
    });
    expect(await pilihanTersimpan()).toEqual([]);
  });

  it("operator dengan hak finalisasi memilih Dikirim: tersimpan, halaman dimuat ulang, dan draft menampilkan siapa dan kapan", async () => {
    await masukOperator(["finalisasi", "input-stok"]);
    expect(await ubahDikirimPekanIni(pilihan(true))).toEqual({ keadaan: "berhasil" });
    expect(kepala.dimuatUlang).toEqual([`/pengiriman-gudang/${gudang.id}`]);
    expect(await pilihanTersimpan()).toMatchObject([{ tokoId: bxc.id, tanggalKirim: RABU_28, dikirim: true }]);

    const html = await bukaToko();
    expect(html).not.toContain("data-tidak-dikirim-pekan-ini");
    expect(html).not.toContain("data-finalisasi-tidak-dikirim");
    // Stok BXC belum diisi: alasan biasa menahan finalisasi.
    expect(html).toContain(`data-finalisasi-tertahan="${bxc.id}"`);
    const bagian = bagianPilihan(html);
    expect(bagian).toMatch(/<input[^>]*data-pilihan-dikirim="ya"[^>]*checked=""/);
    expect(teks(bagian)).toContain(`Dipilih Uji viewer pada ${formatTanggal(tanggalWib(new Date()))}`);
  });
});
