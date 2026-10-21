"use client";

import { KeyRound } from "lucide-react";
import { useId, useState } from "react";

import { IsianKataSandi } from "@/components/isian-kata-sandi";
import { usePenyimpanan } from "@/components/keadaan-simpan";
import { PesanStatusSimpan } from "@/components/pesan-status-simpan";
import { Button } from "@/components/ui/button";
import { Dialog, DialogIsi, DialogPortal } from "@/components/ui/dialog";

import { aturUlangKataSandi } from "./aksi";

const isianKosong = { sandiBaru: "", ulangiSandiBaru: "" };

/** Isi dialog; dipasang ulang setiap kali dialog dibuka, jadi isian selalu mulai kosong. */
function FormAturUlangKataSandi({ idPengguna, nama }: { idPengguna: string; nama: string }) {
  const id = useId();
  const [isian, setIsian] = useState(isianKosong);
  const { tampilan, menunggu, tandaiBerubah, simpan } = usePenyimpanan("daftar pengguna");

  function ubah(kolom: keyof typeof isianKosong, nilai: string) {
    setIsian((sebelumnya) => ({ ...sebelumnya, [kolom]: nilai }));
    tandaiBerubah();
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        simpan(() => aturUlangKataSandi({ idPengguna, ...isian }), () => setIsian(isianKosong));
      }}
    >
      <p>{nama} akan keluar dari semua perangkat dan harus masuk dengan kata sandi baru.</p>
      <div className="flex flex-col gap-2">
        <label className="font-semibold" htmlFor={`${id}-baru`}>
          Kata sandi baru
        </label>
        <IsianKataSandi
          id={`${id}-baru`}
          required
          minLength={8}
          autoComplete="new-password"
          aria-describedby={`${id}-baru-keterangan`}
          value={isian.sandiBaru}
          onChange={(e) => ubah("sandiBaru", e.target.value)}
        />
        <span id={`${id}-baru-keterangan`} className="text-muted-foreground">
          Minimal 8 karakter.
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <label className="font-semibold" htmlFor={`${id}-ulangi`}>
          Ulangi kata sandi baru
        </label>
        <IsianKataSandi
          id={`${id}-ulangi`}
          required
          minLength={8}
          autoComplete="new-password"
          value={isian.ulangiSandiBaru}
          onChange={(e) => ubah("ulangiSandiBaru", e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={menunggu}>
          Simpan kata sandi
        </Button>
        {tampilan ? <PesanStatusSimpan keadaan={tampilan.keadaan} pesan={tampilan.pesan} /> : null}
      </div>
    </form>
  );
}

/**
 * Tombol "Atur ulang kata sandi" dan dialognya (T137, GLOSSARY "Atur ulang kata sandi", DESIGN §11.2). Tidak dipasang di
 * baris akun sendiri; server juga menolaknya. Dialog dirender lewat portal karena pembukanya berada di sel tabel.
 */
export function DialogAturUlangKataSandi({ idPengguna, nama }: { idPengguna: string; nama: string }) {
  const [terbuka, setTerbuka] = useState(false);
  return (
    <Dialog open={terbuka} onOpenChange={setTerbuka}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={`Atur ulang kata sandi ${nama}`}
        onClick={() => setTerbuka(true)}
      >
        <KeyRound aria-hidden strokeWidth={2} className="size-5" />
        Atur ulang kata sandi
      </Button>
      <DialogPortal>
        <DialogIsi bentuk="tengah" judul={`Atur ulang kata sandi ${nama}`} className="max-w-lg">
          <FormAturUlangKataSandi idPengguna={idPengguna} nama={nama} />
        </DialogIsi>
      </DialogPortal>
    </Dialog>
  );
}
