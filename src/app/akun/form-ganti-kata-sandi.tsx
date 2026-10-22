"use client";

import { TriangleAlert } from "lucide-react";
import { useId, useState } from "react";

import { IsianKataSandi } from "@/components/isian-kata-sandi";
import { usePenyimpanan } from "@/components/keadaan-simpan";
import { PesanStatusSimpan } from "@/components/pesan-status-simpan";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { gantiKataSandi } from "./aksi";

const isianKosong = { sandiSaatIni: "", sandiBaru: "", ulangiSandiBaru: "" };

type Kolom = keyof typeof isianKosong;

const daftarIsian: { kolom: Kolom; label: string; autoComplete: string; keterangan?: string }[] = [
  { kolom: "sandiSaatIni", label: "Kata sandi saat ini", autoComplete: "current-password" },
  { kolom: "sandiBaru", label: "Kata sandi baru", autoComplete: "new-password", keterangan: "Minimal 8 karakter." },
  { kolom: "ulangiSandiBaru", label: "Ulangi kata sandi baru", autoComplete: "new-password" },
];

const PESAN_BERHASIL = "Kata sandi berhasil diganti. Perangkat lain sudah dikeluarkan.";

// Hasil belum pasti (jaringan putus): kata sandi mungkin sudah berganti, jadi diperiksa dulu, tidak diulang otomatis.
const YANG_DIPERIKSA = "apakah kata sandi baru sudah berlaku";

/**
 * Form Ganti kata sandi di Akun saya (T138, PRD A3 ▶ Keputusan 2026-10-20). Setiap isian punya tombol mata sendiri
 * (DESIGN §6 ▶ Keputusan 2026-10-20). Setelah tersimpan, semua isian dikosongkan.
 * Panjang kata sandi diperiksa server, bukan dengan `minLength`, agar penolakannya selalu berbahasa Indonesia (pesan
 * bawaan browser mengikuti bahasa browser).
 * `bukanAdmin`: akun ini bukan admin, jadi admin dapat melihat kata sandinya; keterangannya tampil di atas isian.
 */
export function FormGantiKataSandi({ bukanAdmin }: { bukanAdmin: boolean }) {
  const id = useId();
  const [isian, setIsian] = useState(isianKosong);
  const { tampilan, menunggu, tandaiBerubah, simpan } = usePenyimpanan(YANG_DIPERIKSA);

  function ubah(kolom: Kolom, nilai: string) {
    setIsian((sebelumnya) => ({ ...sebelumnya, [kolom]: nilai }));
    tandaiBerubah();
  }

  return (
    <Card>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          simpan(
            () => gantiKataSandi(isian),
            () => setIsian(isianKosong),
          );
        }}
      >
        <CardHeader>
          <CardTitle level={2}>Ganti kata sandi</CardTitle>
          {bukanAdmin ? (
            <p data-keterangan-admin-melihat className="flex items-start gap-2 text-sm">
              <TriangleAlert aria-hidden strokeWidth={2} className="size-5 shrink-0 text-warning" />
              <span>Admin dapat melihat kata sandi akun ini. Jangan memakai kata sandi yang juga Anda pakai di tempat lain.</span>
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {daftarIsian.map(({ kolom, label, autoComplete, keterangan }) => (
            <div key={kolom} className="flex flex-col gap-2">
              <label className="font-semibold" htmlFor={`${id}-${kolom}`}>
                {label}
              </label>
              <IsianKataSandi
                id={`${id}-${kolom}`}
                name={kolom}
                required
                autoComplete={autoComplete}
                aria-describedby={keterangan ? `${id}-${kolom}-keterangan` : undefined}
                value={isian[kolom]}
                onChange={(e) => ubah(kolom, e.target.value)}
              />
              {keterangan ? (
                <span id={`${id}-${kolom}-keterangan`} className="text-muted-foreground">
                  {keterangan}
                </span>
              ) : null}
            </div>
          ))}
        </CardContent>
        <CardFooter className="flex-wrap gap-4">
          <Button type="submit" disabled={menunggu} className="active:scale-95">
            Ganti kata sandi
          </Button>
          {tampilan ? (
            <PesanStatusSimpan
              keadaan={tampilan.keadaan}
              pesan={tampilan.pesan}
              label={tampilan.keadaan === "berhasil" ? PESAN_BERHASIL : undefined}
            />
          ) : null}
        </CardFooter>
      </form>
    </Card>
  );
}
