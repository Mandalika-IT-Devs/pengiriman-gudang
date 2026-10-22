import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// T137 (PRD A3 ▶ Keputusan 2026-10-20): salinan kata sandi akun bukan admin yang bisa dibaca admin.
// - AES-256-GCM dengan IV acak untuk setiap enkripsi.
// - Kunci diturunkan dari rahasia aplikasi (BETTER_AUTH_SECRET) dengan HKDF-SHA256 dan label khusus keperluan ini, jadi
//   kunci tidak pernah ada di database atau backup `pg_dump`.
// - `ikatan` ikut diautentikasi (AAD) tanpa disimpan: salinan hanya terbaca dengan ikatan yang sama persis. Pemanggil
//   mengikatnya ke akun dan hash kata sandi yang berlaku, sehingga salinan lama tidak terbaca lagi setelah kata sandi
//   berganti.
// - Salinan yang tidak terbaca (rahasia berganti, ikatan berbeda, rusak) menghasilkan `null`.

const ALGORITMA = "aes-256-gcm";
const LABEL_KUNCI = "mandalika/salinan-kata-sandi/v1";
const VERSI = "v1";
const PANJANG_IV = 12;
const PANJANG_TAG = 16;

function rahasiaAplikasi(): string {
  const rahasia = process.env.BETTER_AUTH_SECRET;
  if (!rahasia) throw new Error("BETTER_AUTH_SECRET belum diset.");
  return rahasia;
}

function turunkanKunci(rahasia: string): Buffer {
  return Buffer.from(hkdfSync("sha256", rahasia, Buffer.alloc(0), LABEL_KUNCI, 32));
}

/** Salinan terenkripsi `sandi`, berbentuk `v1.<iv>.<tag>.<isi>` (base64url). */
export function enkripsiSalinan(sandi: string, ikatan: string, rahasia = rahasiaAplikasi()): string {
  const iv = randomBytes(PANJANG_IV);
  const cipher = createCipheriv(ALGORITMA, turunkanKunci(rahasia), iv, { authTagLength: PANJANG_TAG });
  cipher.setAAD(Buffer.from(ikatan, "utf8"));
  const isi = Buffer.concat([cipher.update(sandi, "utf8"), cipher.final()]);
  return [VERSI, iv, cipher.getAuthTag(), isi]
    .map((bagian) => (typeof bagian === "string" ? bagian : bagian.toString("base64url")))
    .join(".");
}

/** Kata sandi dari `salinan`, atau `null` jika tidak terbaca dengan `rahasia` dan `ikatan` ini. */
export function dekripsiSalinan(salinan: string, ikatan: string, rahasia = rahasiaAplikasi()): string | null {
  const [versi, iv, tag, isi, ...lebih] = salinan.split(".");
  if (versi !== VERSI || iv === undefined || tag === undefined || isi === undefined || lebih.length > 0) return null;
  try {
    const bufferIv = Buffer.from(iv, "base64url");
    const bufferTag = Buffer.from(tag, "base64url");
    if (bufferIv.length !== PANJANG_IV || bufferTag.length !== PANJANG_TAG) return null;
    const decipher = createDecipheriv(ALGORITMA, turunkanKunci(rahasia), bufferIv, { authTagLength: PANJANG_TAG });
    decipher.setAAD(Buffer.from(ikatan, "utf8"));
    decipher.setAuthTag(bufferTag);
    return Buffer.concat([decipher.update(Buffer.from(isi, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
