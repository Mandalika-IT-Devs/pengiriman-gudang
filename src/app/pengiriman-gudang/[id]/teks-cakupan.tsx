import { BantuanIstilah } from "@/components/bantuan-istilah";
import type { PolaJadwal } from "@/server/gudang/pilihan-jadwal";

// Teks cakupan lengkap (DESIGN §11.6, T121) di draft, rincian baris, dan rincian rencana final. Panjang cakupan (L) dan
// persiapan (p) adalah hasil hitung yang tersimpan; cakupan H−p sampai H+L−1 (GLOSSARY.md) berisi p + L hari. Toko dua
// mingguan selalu memakai L = 14, jadi teksnya menyebut dua minggu, bukan "sampai sebelum kiriman berikutnya" (PRD A5 ▶
// Revisi 2026-10-19, T135). Snapshot dua mingguan lama dengan L selain 14 (aturan sebelum revisi itu) memakai teks lama.

/** Akhir teks setelah panjang cakupan: "(dua minggu)" untuk dua mingguan dengan L = 14, selain itu teks lama. */
function akhirTeks(panjangCakupan: number, polaJadwal: PolaJadwal) {
  return polaJadwal === "dua-mingguan" && panjangCakupan === 14 ? "(dua minggu)" : "sampai sebelum kiriman berikutnya";
}

/**
 * Mis. p = 1, L = 7 → "Cakupan 8 hari: persiapan 1 hari + 7 hari sampai sebelum kiriman berikutnya"; dua mingguan p = 1,
 * L = 14 → "Cakupan 15 hari: persiapan 1 hari + 14 hari (dua minggu)"; p = 0 tanpa persiapan.
 */
export function teksCakupan(persiapanHari: number, panjangCakupan: number, polaJadwal: PolaJadwal) {
  const persiapan = persiapanHari > 0 ? `persiapan ${persiapanHari} hari + ` : "";
  return `Cakupan ${persiapanHari + panjangCakupan} hari: ${persiapan}${panjangCakupan} hari ${akhirTeks(panjangCakupan, polaJadwal)}`;
}

/**
 * Teks cakupan dengan bantuan istilah di samping "Cakupan", "persiapan", dan panjang cakupan. Tombol bantuan hanya
 * berlabel `aria-label`, jadi teks yang terbaca sama persis dengan `teksCakupan`.
 */
export function TeksCakupan({
  persiapanHari,
  panjangCakupan,
  polaJadwal,
}: {
  persiapanHari: number;
  panjangCakupan: number;
  polaJadwal: PolaJadwal;
}) {
  return (
    <span data-teks-cakupan={teksCakupan(persiapanHari, panjangCakupan, polaJadwal)}>
      Cakupan
      <BantuanIstilah istilah="cakupan" /> {persiapanHari + panjangCakupan} hari:{" "}
      {persiapanHari > 0 ? (
        <>
          persiapan
          <BantuanIstilah istilah="persiapan" /> {persiapanHari} hari +{" "}
        </>
      ) : null}
      {panjangCakupan} hari
      <BantuanIstilah istilah="panjangCakupan" /> {akhirTeks(panjangCakupan, polaJadwal)}
    </span>
  );
}
