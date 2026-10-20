"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Isian kata sandi dengan tombol mata di sisi kanan (DESIGN §6 ▶ Keputusan 2026-10-20), dipakai di dialog Atur ulang kata
 * sandi dan form Ganti kata sandi (Akun saya).
 * - Isi awalnya tersembunyi. Tombol menampilkan atau menyembunyikannya, tanpa mengirim form (`type="button"`).
 * - Ikon `Eye` saat tersembunyi, `EyeOff` saat terlihat. Nama aksesibel tetap "Tampilkan kata sandi"; `aria-pressed`
 *   bernilai true saat isi terlihat.
 * - Setiap isian punya tombolnya sendiri, dengan ukuran sentuh 44 px (§9).
 * Label diletakkan di luar komponen ini (`<label htmlFor>`), agar nama tombol tidak ikut menjadi nama isian.
 */
export function IsianKataSandi({ className, id, ...props }: Omit<ComponentProps<typeof Input>, "type" | "ukuran">) {
  const [terlihat, setTerlihat] = useState(false);
  const Ikon = terlihat ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input id={id} type={terlihat ? "text" : "password"} className={cn("pr-14", className)} {...props} />
      <Button
        type="button"
        variant="ghost"
        aria-label="Tampilkan kata sandi"
        aria-pressed={terlihat}
        aria-controls={id}
        data-tombol-mata
        className="absolute inset-y-0 right-0.5 my-auto size-11 px-0"
        onClick={() => setTerlihat((sebelumnya) => !sebelumnya)}
      >
        <Ikon aria-hidden strokeWidth={2} className="size-5" />
      </Button>
    </div>
  );
}
