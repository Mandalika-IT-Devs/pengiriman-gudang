import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { wajibMasuk } from "@/server/auth/kewenangan";
import { daftarGudangDapatDilihat } from "@/server/gudang/akses";

import { FormGantiKataSandi } from "./form-ganti-kata-sandi";

export const metadata: Metadata = {
  title: "Akun saya — Dashboard Penjualan MANDALIKA",
};

type PeranTampil = "admin" | "operator" | "viewer";

/** Label peran sama dengan sidebar (GLOSSARY.md, `layout.tsx`). */
const labelPeran: Record<PeranTampil, string> = { admin: "Admin", operator: "Operator", viewer: "Viewer" };

/**
 * Akun saya (T138, GLOSSARY "Akun saya", PRD A3 ▶ Keputusan 2026-10-20): semua pengguna yang sudah masuk. Zona kerja
 * (DESIGN §1), lebar form tunggal (§9). Nama, email, dan peran hanya-baca; peran memakai aturan sidebar: admin; operator =
 * bukan admin, tetapi ditugaskan ke gudang aktif; selain itu viewer.
 */
export default async function HalamanAkun() {
  const pengguna = await wajibMasuk();
  const daftarGudang = await daftarGudangDapatDilihat(pengguna);
  const peran: PeranTampil = pengguna.peran === "admin" ? "admin" : daftarGudang.length > 0 ? "operator" : "viewer";
  const data = [
    { label: "Nama", nilai: pengguna.nama },
    { label: "Email", nilai: pengguna.email },
    { label: "Peran", nilai: labelPeran[peran] },
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 text-sm sm:px-6 md:py-8 lg:px-8">
      <h1 className="text-2xl font-bold md:text-3xl">Akun saya</h1>

      <Card>
        <dl className="flex flex-col gap-3">
          {data.map(({ label, nilai }) => (
            <div key={label} className="flex flex-col gap-1 sm:flex-row sm:gap-6">
              <dt className="font-semibold text-muted-foreground sm:w-20 sm:shrink-0">{label}</dt>
              <dd className="min-w-0 break-words">{nilai}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <FormGantiKataSandi bukanAdmin={pengguna.peran !== "admin"} />
    </main>
  );
}
