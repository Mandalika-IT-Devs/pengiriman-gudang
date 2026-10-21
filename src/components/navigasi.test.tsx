import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const tiruan = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => tiruan.pathname }));
vi.mock("@/app/keluar/aksi", () => ({ keluar: async () => undefined }));

const { Navigasi } = await import("./navigasi");

// T78: sidebar berkelompok (DESIGN §6 ▶ Keputusan 2026-10-11).

const ADMIN = { nama: "Admin Uji", peran: "admin" } as const;
const OPERATOR = { nama: "Operator Uji", peran: "operator" } as const;
const VIEWER = { nama: "Viewer Uji", peran: "viewer" } as const;

function render(props: Parameters<typeof Navigasi>[0], pathname = "/") {
  tiruan.pathname = pathname;
  return renderToStaticMarkup(<Navigasi {...props} />);
}

function tautan(html: string) {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);
}

/** Judul kelompok yang terbuka (aria-expanded="true"). */
function kelompokTerbuka(html: string) {
  return [...html.matchAll(/<button [^>]*data-kelompok="([^"]*)"[^>]*aria-expanded="true"/g)].map((m) => m[1]);
}

/** Judul kelompok, sesuai urutan tampil. */
function judulKelompok(html: string) {
  return [...html.matchAll(/data-kelompok="([^"]*)"/g)].map((m) => m[1]);
}

describe("Navigasi: kelompok menu per peran", () => {
  // T127 — DESIGN §6 ▶ Keputusan (2026-10-14, pemilik): "Riwayat" item tunggal tanpa kelompok tepat di bawah Beranda.
  // T136 — DESIGN §6 ▶ Revisi (2026-10-20, pemilik): hanya untuk admin dan operator (akses yang sama dengan Pengiriman
  // Gudang); viewer tidak melihatnya.
  it.each([
    ["admin", ADMIN, true],
    ["operator", OPERATOR, true],
  ] as const)("%s: Riwayat tepat di bawah Beranda, di luar kelompok mana pun", (_peran, pengguna, tampilkanPengirimanGudang) => {
    const html = render({ pengguna, tampilkanPengirimanGudang, tampilkanJadwalToko: false, children: null });
    expect(tautan(html).slice(0, 2)).toEqual([
      ["/", "Beranda"],
      ["/riwayat", "Riwayat"],
    ]);
    // Beranda dan Riwayat berada di daftar yang sama, sebelum judul kelompok pertama.
    const sebelumKelompok = html.slice(0, html.indexOf("data-kelompok="));
    expect(sebelumKelompok).toMatch(/<ul[^>]*><li><a [^>]*href="\/"[^>]*>Beranda<\/a><\/li><li><a [^>]*href="\/riwayat"[^>]*>Riwayat<\/a><\/li><\/ul>/);
  });

  // T105 — DESIGN §6 ▶ Keputusan (2026-10-13 sore, pemilik): kelompok Pengiriman Gudang dihapus; Pengiriman Gudang
  // masuk Pekerjaan rutin. Kirim di luar jadwal tepat setelah Pengiriman Gudang (T113). T112: Salin jadwal
  // operator dihapus; Jadwal toko menjadi item pertama Data Master.
  it("admin dengan hak jadwal melihat Beranda, Pekerjaan rutin, Laporan, Data Master, dan Pengaturan persis DESIGN §6", () => {
    const html = render({ pengguna: ADMIN, tampilkanPengirimanGudang: true, tampilkanJadwalToko: true, children: null });
    expect(judulKelompok(html)).toEqual(["Pekerjaan rutin", "Laporan", "Data Master", "Pengaturan"]);
    expect(tautan(html)).toEqual([
      ["/", "Beranda"],
      ["/riwayat", "Riwayat"],
      ["/admin/impor", "Impor penjualan"],
      ["/admin/ranking", "Ranking pusat"],
      ["/admin/jadwal", "Persetujuan jadwal"],
      ["/pengiriman-gudang", "Pengiriman Gudang"],
      ["/usulan-jadwal", "Kirim di luar jadwal"],
      ["/ringkasan", "Ringkasan"],
      ["/kalender", "Kalender"],
      ["/admin/jadwal-toko", "Jadwal toko"],
      ["/admin/keluarga-aroma", "Keluarga aroma"],
      ["/admin/pemetaan-produk", "Pemetaan produk"],
      ["/admin/alias-stok", "Alias nama stok"],
      ["/admin/libur", "Libur"],
      ["/admin/gudang", "Gudang"],
      ["/admin/toko", "Toko"],
      ["/admin/pengguna", "Pengguna"],
      ["/admin/penugasan", "Penugasan"],
    ]);
    expect(html).not.toContain("Organisasi");
  });

  it("admin tanpa hak jadwal: Pekerjaan rutin = Impor penjualan, Ranking pusat, Persetujuan jadwal, Pengiriman Gudang; tanpa kelompok Pengiriman Gudang", () => {
    const html = render({ pengguna: ADMIN, tampilkanPengirimanGudang: true, tampilkanJadwalToko: false, children: null });
    expect(judulKelompok(html)).toEqual(["Pekerjaan rutin", "Laporan", "Data Master", "Pengaturan"]);
    expect(tautan(html).slice(0, 7)).toEqual([
      ["/", "Beranda"],
      ["/riwayat", "Riwayat"],
      ["/admin/impor", "Impor penjualan"],
      ["/admin/ranking", "Ranking pusat"],
      ["/admin/jadwal", "Persetujuan jadwal"],
      ["/pengiriman-gudang", "Pengiriman Gudang"],
      ["/ringkasan", "Ringkasan"],
    ]);
    expect(html).not.toContain("/usulan-jadwal");
    expect(html).not.toContain("/salin-jadwal");
  });

  it("operator berhak jadwal: Pekerjaan rutin = Pengiriman Gudang, Kirim di luar jadwal; tanpa Salin jadwal", () => {
    const html = render({ pengguna: OPERATOR, tampilkanPengirimanGudang: true, tampilkanJadwalToko: true, children: null });
    expect(judulKelompok(html)).toEqual(["Pekerjaan rutin", "Laporan"]);
    expect(tautan(html)).toEqual([
      ["/", "Beranda"],
      ["/riwayat", "Riwayat"],
      ["/pengiriman-gudang", "Pengiriman Gudang"],
      ["/usulan-jadwal", "Kirim di luar jadwal"],
      ["/ringkasan", "Ringkasan"],
      ["/kalender", "Kalender"],
    ]);
    expect(html).not.toContain("Salin jadwal");
    expect(html).not.toContain("/admin/");
    expect(html).not.toContain("Data Master");
    expect(html).not.toContain("Pengaturan");
  });

  it("operator tanpa hak jadwal: Pekerjaan rutin hanya berisi Pengiriman Gudang", () => {
    const html = render({ pengguna: OPERATOR, tampilkanPengirimanGudang: true, tampilkanJadwalToko: false, children: null });
    expect(judulKelompok(html)).toEqual(["Pekerjaan rutin", "Laporan"]);
    expect(tautan(html)).toEqual([
      ["/", "Beranda"],
      ["/riwayat", "Riwayat"],
      ["/pengiriman-gudang", "Pengiriman Gudang"],
      ["/ringkasan", "Ringkasan"],
      ["/kalender", "Kalender"],
    ]);
    expect(html).not.toContain("jadwal");
  });

  // T136 — DESIGN §6 ▶ Revisi (2026-10-20): viewer kembali melihat Beranda dan Laporan saja, tanpa Riwayat.
  it("viewer tanpa penugasan melihat Beranda dan Laporan saja (tanpa Riwayat dan Pekerjaan rutin)", () => {
    const html = render({ pengguna: VIEWER, tampilkanPengirimanGudang: false, tampilkanJadwalToko: false, children: null });
    expect(judulKelompok(html)).toEqual(["Laporan"]);
    expect(tautan(html)).toEqual([
      ["/", "Beranda"],
      ["/ringkasan", "Ringkasan"],
      ["/kalender", "Kalender"],
    ]);
    expect(html).not.toContain("/riwayat");
    expect(html).not.toContain("Pekerjaan rutin");
    expect(html).not.toContain("Pengiriman Gudang");
    expect(html).not.toContain("Data Master");
    expect(html).not.toContain("Pengaturan");
    expect(html).not.toContain("/admin/");
  });

  it("tanpa pengguna yang masuk: tanpa navigasi, hanya isi halaman", () => {
    const html = render({ pengguna: null, tampilkanPengirimanGudang: false, tampilkanJadwalToko: false, children: <p>isi</p> });
    expect(html).toBe("<p>isi</p>");
  });

  it("halaman masuk tetap tanpa navigasi walaupun ada sesi", () => {
    const html = render({ pengguna: ADMIN, tampilkanPengirimanGudang: true, tampilkanJadwalToko: true, children: <p>isi</p> }, "/masuk");
    expect(html).toBe("<p>isi</p>");
  });
});

describe("Navigasi: penanda halaman aktif", () => {
  function tautanAktif(html: string) {
    return [...html.matchAll(/<a [^>]*aria-current="page"[^>]*href="([^"]*)"|<a [^>]*href="([^"]*)"[^>]*aria-current="page"/g)].map(
      (m) => m[1] ?? m[2],
    );
  }

  it("di beranda hanya Beranda yang aktif", () => {
    expect(tautanAktif(render({ pengguna: ADMIN, tampilkanPengirimanGudang: true, tampilkanJadwalToko: true, children: null }, "/"))).toEqual(["/"]);
  });

  it("sub-halaman menandai item induknya (/admin/impor/12 → Impor penjualan), bukan Beranda", () => {
    expect(
      tautanAktif(render({ pengguna: ADMIN, tampilkanPengirimanGudang: true, tampilkanJadwalToko: true, children: null }, "/admin/impor/12")),
    ).toEqual(["/admin/impor"]);
  });

  it("/pengiriman-gudang/3/rencana-final/7 → Pengiriman Gudang", () => {
    expect(
      tautanAktif(
        render({ pengguna: OPERATOR, tampilkanPengirimanGudang: true, tampilkanJadwalToko: true, children: null }, "/pengiriman-gudang/3/rencana-final/7"),
      ),
    ).toEqual(["/pengiriman-gudang"]);
  });

  // T127 (DESIGN §6 ▶ Keputusan 2026-10-14): rincian rencana final di bawah /riwayat menandai Riwayat.
  it("/riwayat/rencana-final/7 → Riwayat aktif, tanpa kelompok terbuka", () => {
    const html = render({ pengguna: OPERATOR, tampilkanPengirimanGudang: true, tampilkanJadwalToko: false, children: null }, "/riwayat/rencana-final/7");
    expect(tautanAktif(html)).toEqual(["/riwayat"]);
    expect(kelompokTerbuka(html)).toEqual([]);
  });

  it("/pengiriman-gudang/3 → Pengiriman Gudang aktif dan kelompok Pekerjaan rutin terbuka", () => {
    const html = render({ pengguna: OPERATOR, tampilkanPengirimanGudang: true, tampilkanJadwalToko: true, children: null }, "/pengiriman-gudang/3");
    expect(tautanAktif(html)).toEqual(["/pengiriman-gudang"]);
    expect(kelompokTerbuka(html)).toEqual(["Pekerjaan rutin"]);
  });

  it("/admin/jadwal-toko/3 → Jadwal toko aktif (bukan Persetujuan jadwal) dan kelompok Data Master terbuka", () => {
    const html = render({ pengguna: ADMIN, tampilkanPengirimanGudang: true, tampilkanJadwalToko: false, children: null }, "/admin/jadwal-toko/3");
    expect(tautanAktif(html)).toEqual(["/admin/jadwal-toko"]);
    expect(kelompokTerbuka(html)).toEqual(["Data Master"]);
  });

  it("/usulan-jadwal/3 → Kirim di luar jadwal aktif dan kelompok Pekerjaan rutin terbuka", () => {
    const html = render({ pengguna: OPERATOR, tampilkanPengirimanGudang: true, tampilkanJadwalToko: true, children: null }, "/usulan-jadwal/3");
    expect(tautanAktif(html)).toEqual(["/usulan-jadwal"]);
    expect(kelompokTerbuka(html)).toEqual(["Pekerjaan rutin"]);
  });

  // T138: halaman Akun saya menandai tautan nama dan peran; tidak ada item navigasi lain yang aktif.
  it("/akun → tautan Akun saya aktif (aria-current, latar accent, peran tetap kontras), item lain tidak", () => {
    const html = render({ pengguna: VIEWER, tampilkanPengirimanGudang: false, tampilkanJadwalToko: false, children: null }, "/akun");
    expect(tautanAktif(html)).toEqual(["/akun"]);
    expect(kelompokTerbuka(html)).toEqual([]);
    const tautan = html.match(/<a [^>]*href="\/akun"[^>]*>.*?<\/a>/)?.[0] ?? "";
    expect(tautan).toContain("bg-accent");
    expect(tautan).toContain("text-accent-foreground");
    // DESIGN §2 ▶ Keputusan 2026-10-09: teks sekunder di atas accent tidak memakai muted-foreground.
    expect(tautan).not.toContain("text-muted-foreground");
  });

  it("di halaman lain tautan Akun saya tidak aktif", () => {
    const html = render({ pengguna: VIEWER, tampilkanPengirimanGudang: false, tampilkanJadwalToko: false, children: null }, "/ringkasan");
    const tautan = html.match(/<a [^>]*href="\/akun"[^>]*>/)?.[0] ?? "";
    expect(tautan).not.toContain("aria-current");
    expect(tautan).not.toContain("bg-accent");
  });

  it("item aktif memakai latar accent dan teks accent-foreground (DESIGN §6)", () => {
    const html = render({ pengguna: ADMIN, tampilkanPengirimanGudang: true, tampilkanJadwalToko: true, children: null }, "/ringkasan");
    const aktif = html.match(/<a [^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
    expect(aktif).toContain("bg-accent");
    expect(aktif).toContain("text-accent-foreground");
  });
});

describe("Navigasi: tampilan sidebar", () => {
  const html = render({ pengguna: OPERATOR, tampilkanPengirimanGudang: true, tampilkanJadwalToko: true, children: <p>isi</p> });

  it("satu navigasi utama bernama 'Navigasi utama', dengan logo dalam lingkaran moss dan MANDALIKA (bukan Fraunces)", () => {
    expect(html.match(/aria-label="Navigasi utama"/g)?.length).toBe(1);
    expect(html).toContain("rounded-full bg-primary");
    expect(html).toContain(">MANDALIKA</span>");
    expect(html).not.toContain("font-heading");
  });

  it("sidebar berlatar card, lebar 240 px di desktop, dan tersembunyi di layar kecil; menu tarik tertutup saat dimuat", () => {
    const aside = html.match(/<aside [^>]*class="([^"]*)"/)?.[1] ?? "";
    expect(aside).toContain("bg-card");
    expect(aside).toContain("w-60");
    expect(aside.split(" ")).toContain("hidden");
    expect(aside).toContain("lg:flex");
    // T108: menu tarik layar kecil adalah dialog yang baru dirender saat dibuka.
    expect(html).not.toContain('role="dialog"');
  });

  it("isi halaman berada di sebelah kanan sidebar", () => {
    expect(html).toMatch(/<div class="[^"]*lg:pl-60[^"]*"><p>isi<\/p><\/div>/);
  });

  it("di bawah: nama pengguna, peran, lalu tombol Keluar di dalam form", () => {
    const posisiNama = html.indexOf("Operator Uji");
    const posisiPeran = html.indexOf(">Operator<");
    const posisiKeluar = html.indexOf("Keluar");
    expect(posisiNama).toBeGreaterThan(-1);
    expect(posisiPeran).toBeGreaterThan(posisiNama);
    expect(posisiKeluar).toBeGreaterThan(posisiPeran);
    expect([...html.matchAll(/<form[^>]*>\s*<button type="submit"/g)]).toHaveLength(1);
  });

  // T138 — DESIGN §6 ▶ Keputusan (2026-10-20): nama dan peran menjadi tautan ke Akun saya, di atas Keluar.
  it.each([
    ["admin", ADMIN, "Admin Uji", "Admin"],
    ["operator", OPERATOR, "Operator Uji", "Operator"],
    ["viewer", VIEWER, "Viewer Uji", "Viewer"],
  ] as const)("%s: nama dan peran adalah tautan 'Akun saya' ke /akun, di atas Keluar", (_peran, pengguna, nama, peran) => {
    const html = render({ pengguna, tampilkanPengirimanGudang: pengguna !== VIEWER, tampilkanJadwalToko: false, children: null });
    const akun = [...html.matchAll(/<a [^>]*href="\/akun"[^>]*>(.*?)<\/a>/g)];
    // Satu di sidebar desktop; menu tarik baru dirender saat dibuka (navigasi-menu-tarik.test.tsx).
    expect(akun).toHaveLength(1);
    const [tautan, isi] = [akun[0]![0], akun[0]![1]!];
    expect(tautan).toContain('aria-label="Akun saya"');
    expect(isi.replace(/<[^>]+>/g, "|")).toMatch(new RegExp(`^\\|*${nama}\\|+${peran}\\|*$`));
    // "Keluar</button>", bukan "Keluarga aroma".
    expect(html.indexOf(tautan)).toBeLessThan(html.indexOf("Keluar</button>"));
    // Di luar navigasi utama, di blok bawah bersama Keluar.
    expect(html.indexOf(tautan)).toBeGreaterThan(html.indexOf("</nav>"));
  });

  it("label peran: Admin, Operator, Viewer", () => {
    expect(render({ pengguna: ADMIN, tampilkanPengirimanGudang: true, tampilkanJadwalToko: true, children: null })).toContain(">Admin<");
    expect(render({ pengguna: VIEWER, tampilkanPengirimanGudang: false, tampilkanJadwalToko: false, children: null })).toContain(">Viewer<");
  });

  it("tombol menu di layar kecil bisa dipakai keyboard dan memberi tahu keadaannya", () => {
    expect(html).toMatch(/<button type="button"[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+"/);
    expect(html).toContain('aria-label="Buka menu"');
  });

  it("tautan dan tombol punya fokus yang terlihat dan tinggi sentuh 44 px", () => {
    const elemen = [...html.matchAll(/<(a|button) [^>]*class="([^"]*)"/g)];
    expect(elemen.length).toBeGreaterThan(4);
    for (const [, , kelas] of elemen) {
      expect(kelas).toContain("focus-visible:ring-2");
      expect(kelas).toContain("focus-visible:ring-ring");
      expect(kelas).toMatch(/\b(min-h-11|size-11)\b/);
    }
  });

  it("ikon 20 px, stroke 2, disembunyikan dari pembaca layar (DESIGN §6)", () => {
    const ikon = [...html.matchAll(/<svg[^>]*>/g)].map((m) => m[0]);
    expect(ikon.length).toBeGreaterThan(0);
    for (const tag of ikon) {
      expect(tag).toContain('stroke-width="2"');
      expect(tag).toContain('aria-hidden="true"');
      expect(tag).toContain("size-5");
    }
  });
});
