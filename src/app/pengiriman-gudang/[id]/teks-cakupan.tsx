import { BantuanIstilah } from "@/components/bantuan-istilah";
import { TAMBAHAN_HARI_CAKUPAN } from "@/domain/pengiriman";
import type { PolaJadwal } from "@/server/gudang/pilihan-jadwal";

// Teks cakupan lengkap (DESIGN §11.6, T121) di draft, rincian baris, dan rincian rencana final. Panjang cakupan (L) dan
// persiapan (p) adalah hasil hitung yang tersimpan; cakupan H−p sampai H+L−1 (GLOSSARY.md) berisi p + L hari. Toko dua
// mingguan selalu memakai L = 14, jadi teksnya menyebut dua minggu, bukan "sampai sebelum kiriman berikutnya" (PRD A5 ▶
// Revisi 2026-10-19, T135). Snapshot dua mingguan lama dengan L selain 14 (aturan sebelum revisi itu) memakai teks lama.
// Toko yang jadwal tetapnya bertanda "Tambah 3 hari cakupan" berisi p + L + 3 hari, dan teksnya diakhiri "+ tambahan 3
// hari" (PRD A5 ▶ Keputusan 2026-10-27, T143); teks toko lain tidak berubah.

/** Akhir teks setelah panjang cakupan: "(dua minggu)" untuk dua mingguan dengan L = 14, selain itu teks lama. */
function akhirTeks(panjangCakupan: number, polaJadwal: PolaJadwal) {
  return polaJadwal === "dua-mingguan" && panjangCakupan === 14 ? "(dua minggu)" : "sampai sebelum kiriman berikutnya";
}

const TEKS_TAMBAHAN = `tambahan ${TAMBAHAN_HARI_CAKUPAN} hari`;

const jumlahHari = (persiapanHari: number, panjangCakupan: number, tambah3HariCakupan: boolean) =>
  persiapanHari + panjangCakupan + (tambah3HariCakupan ? TAMBAHAN_HARI_CAKUPAN : 0);

/**
 * Mis. p = 1, L = 7 → "Cakupan 8 hari: persiapan 1 hari + 7 hari sampai sebelum kiriman berikutnya"; dua mingguan p = 1,
 * L = 14 → "Cakupan 15 hari: persiapan 1 hari + 14 hari (dua minggu)"; p = 0 tanpa persiapan. Bertanda: p = 1, L = 7 →
 * "Cakupan 11 hari: persiapan 1 hari + 7 hari sampai sebelum kiriman berikutnya + tambahan 3 hari".
 */
export function teksCakupan(persiapanHari: number, panjangCakupan: number, polaJadwal: PolaJadwal, tambah3HariCakupan = false) {
  const persiapan = persiapanHari > 0 ? `persiapan ${persiapanHari} hari + ` : "";
  const tambahan = tambah3HariCakupan ? ` + ${TEKS_TAMBAHAN}` : "";
  return `Cakupan ${jumlahHari(persiapanHari, panjangCakupan, tambah3HariCakupan)} hari: ${persiapan}${panjangCakupan} hari ${akhirTeks(panjangCakupan, polaJadwal)}${tambahan}`;
}

/**
 * Teks cakupan dengan bantuan istilah di samping "Cakupan", "persiapan", panjang cakupan, dan "tambahan 3 hari". Tombol
 * bantuan hanya berlabel `aria-label`, jadi teks yang terbaca sama persis dengan `teksCakupan`.
 */
export function TeksCakupan({
  persiapanHari,
  panjangCakupan,
  polaJadwal,
  tambah3HariCakupan = false,
}: {
  persiapanHari: number;
  panjangCakupan: number;
  polaJadwal: PolaJadwal;
  /** Tanda "Tambah 3 hari cakupan" yang dipakai cakupan ini; tidak ada = tidak bertanda. */
  tambah3HariCakupan?: boolean;
}) {
  return (
    <span data-teks-cakupan={teksCakupan(persiapanHari, panjangCakupan, polaJadwal, tambah3HariCakupan)}>
      Cakupan
      <BantuanIstilah istilah="cakupan" /> {jumlahHari(persiapanHari, panjangCakupan, tambah3HariCakupan)} hari:{" "}
      {persiapanHari > 0 ? (
        <>
          persiapan
          <BantuanIstilah istilah="persiapan" /> {persiapanHari} hari +{" "}
        </>
      ) : null}
      {panjangCakupan} hari
      <BantuanIstilah istilah="panjangCakupan" /> {akhirTeks(panjangCakupan, polaJadwal)}
      {tambah3HariCakupan ? (
        <>
          {` + ${TEKS_TAMBAHAN}`}
          <BantuanIstilah istilah="tambah3HariCakupan" />
        </>
      ) : null}
    </span>
  );
}
