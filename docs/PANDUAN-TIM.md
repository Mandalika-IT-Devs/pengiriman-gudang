# Panduan Tim

Untuk tiga orang: **A** dan **B** memakai Claude Code, **C** memakai Codex. Pemilik produk (yang mengambil keputusan bisnis) boleh salah satu dari A, B, atau C.

## 1. Setup sekali (pemilik)

1. **Commit paket ini ke `main`** di repo kosong, sebelum proteksi branch diaktifkan:
   `git add . && git commit -m "docs: paket awal PRD, ADR, aturan agen" && git push origin main`
2. **TP-02:** ganti `@GANTI-PEMILIK` di `.github/CODEOWNERS` dengan username GitHub pemilik, lalu commit langsung ke `main`.
3. **Buat label dan issue awal:** `gh auth login`, lalu `./scripts/buat-issue.sh`. Setelah issue terbentuk, hapus folder `docs/tiket-awal/` dan commit langsung ke `main` (masih sebelum langkah 4). Mulai saat ini GitHub Issues yang menjadi sumber kebenaran.
4. **Proteksi `main`** (Settings → Rules → Rulesets → New branch ruleset, target `main`):
   - Wajib pull request sebelum merge, minimal 1 approval.
   - Wajib review dari Code Owners.
   - Wajib status checks: `kebersihan-pr` dan `verify`.
   - Blokir force push dan penghapusan branch.

   ⚠️ Untuk **repo private**, fitur proteksi branch membutuhkan paket GitHub berbayar (Team untuk organisasi). Di paket Free, CI tetap berjalan dan menandai merah, tetapi **tidak bisa memblokir merge**. Disiplin "merge hanya oleh pemilik" lalu menjadi satu-satunya penjaga.

   Catatan: GitHub tidak mengizinkan penulis PR menyetujui PR-nya sendiri. Jika pemilik juga menulis PR yang menyentuh berkas terlindungi, daftarkan dua code owner, atau pakai bypass admin secara sadar.
5. **Pasang skill Matt Pocock** di Claude Code (A dan B). Ikuti cara instalasi di README `github.com/mattpocock/skills`. Konfigurasi skill sudah ada di `docs/agents/`, jadi `/setup-matt-pocock-skills` **tidak perlu** dijalankan.
6. **Jawab keputusan terbuka** di `docs/OPEN-DECISIONS.md` sebelum tiket yang ditahannya dimulai. Yang paling cepat dibutuhkan: OD-02 dan OD-03 (T21), OD-01 (impor April/Mei), dan OD-10 (T11).

## 2. Pembagian kerja

| Orang | Alat | Fokus | Tiket M0–M1 |
|---|---|---|---|
| A | Claude Code | Fondasi + jalur impor | T00 → T10 → T11 |
| B | Claude Code | Akses & master data | T20 → T21 → T22 |
| C | Codex | Mesin hitung (modul domain murni) | T01, T02, T06 → T03 → T04, T05 |

**Mengapa C (Codex) memegang modul domain:** tiket domain paling sempit batasnya. Modulnya murni, tanpa database, UI, atau dependency, dan dependency-cruiser menegakkan itu. "Selesai" juga didefinisikan oleh fixture golden. Ruang untuk over-engineering paling kecil di sini, dan setiap penyimpangan langsung terlihat sebagai test merah atau pelanggaran lint.

### Urutan

```
Hari 1:   A: T00 (sendiri)          B, C: baca PRD + CONTEXT + ADR; pemilik: setup & OD
Setelah T00 merge, paralel:
  A: T10 ──────────────► T11 (butuh T06, T20, T21)
  B: T20 ─► T21 ─► T22
  C: T01 ┐
     T02 ┼─► T03 ─► T04
     T06 ┘        └─► T05 (butuh T01, T03, T06)
```

Ambil hanya tiket yang semua "Blocked by"-nya sudah ditutup.

### Setelah M1

M2 (laporan, kalender, cache hitung) dan M3 (periode sumber, jadwal & persetujuan, ranking, stok, draft, finalisasi, ekspor) **belum** dipecah menjadi tiket. Sengaja: OD-05, OD-06, dan OD-07 harus dijawab dulu, dan bentuk kode M1 akan memengaruhi irisannya. Setelah M1 selesai, pemilik menjalankan di Claude Code:

```
/to-tickets docs/PRD.md — buat tiket M2: cache hasil hitung + hitung ulang, halaman Ringkasan
(filter, Terapkan, periode aktif), penelusuran sampai sel, ekspor seluruh hasil filter, tampilan
kalender, sinkronisasi snapshot libur, perubahan kategori. Hormati ADR dan OPEN-DECISIONS.
```

## 3. Prompt kerja

### Claude Code (A dan B), per tiket

```
/implement Kerjakan issue [T10]. Ambil isinya: gh issue list --search "[T10] in:title" lalu
gh issue view <nomor> --comments. Baca AGENTS.md dan sumber yang ditunjuknya untuk area ini.
Sebelum menulis kode: tulis seam yang akan dites dan berkas yang akan disentuh, lalu tunggu
persetujuan saya. Branch: t10-<slug>. Hanya isi "Dalam scope". Jika aturan tidak jelas: berhenti
dan tanya. Selesai = semua kriteria penerimaan tercentang + pnpm verify hijau. Lalu /code-review
terhadap main, perbaiki temuan sumbu Spec, dan buka PR dengan template (Closes #<nomor>).
```

### Codex (C), per tiket

Prompt ini sengaja lengkap dan berdiri sendiri, karena Codex tidak memakai hook Claude Code:

```
Tugas: kerjakan SATU issue: [T01] (cari: gh issue list --search "[T01] in:title", lalu
gh issue view <nomor> --comments).

Langkah:
1. Baca AGENTS.md, src/domain/AGENTS.md, CONTEXT.md, CODING_STANDARDS.md, dan ADR yang disebut issue.
2. Tulis rencana: berkas yang dibuat/diubah, fungsi publik beserta tipenya, dan test yang akan
   ditulis dari fixture tests/golden/. Tunggu persetujuan saya.
3. Red → green: tulis test dari fixture dulu, lalu implementasi minimal sampai hijau.
4. Jalankan pnpm verify sampai hijau.
5. Laporkan: daftar berkas yang berubah, kriteria penerimaan yang dicentang satu per satu, dan hal
   yang sengaja TIDAK dikerjakan.

Batas: hanya isi "Dalam scope". Tidak menambah dependency, berkas konfigurasi, export tambahan,
opsi, parameter, atau abstraksi untuk kebutuhan masa depan. Tidak mengubah tests/golden/ atau
berkas terlindungi lain di AGENTS.md. Jika aturan tidak jelas atau fixture tampak salah: berhenti,
jelaskan, dan tanya. Branch: t01-<slug>. PR dengan template, Closes #<nomor>.
```

Jalankan Codex dalam mode yang meminta persetujuan untuk perintah dan penulisan, bukan mode akses penuh.

### Review PR dari Codex (oleh A atau B)

```
Checkout branch t01-<slug>. /code-review terhadap main. Laporkan temuan sumbu Spec, terutama
"behaviour in the diff that wasn't asked for", sebagai komentar PR. Jangan memperbaiki sendiri.
```

## 4. Ritme kerja

- Satu tiket = satu branch = satu PR. PR di atas ±400 baris adalah tanda tiket perlu dipecah.
- Rebase ke `main` sebelum membuka PR.
- **Merge hanya oleh pemilik**, setelah CI hijau dan review.
- Agen menemukan hal yang tidak jelas → komentar di issue + label `needs-info` → pemilik memutuskan → pemilik memperbarui `OPEN-DECISIONS.md` atau ADR → tiket dilanjutkan.
- Mengubah aturan bisnis selalu dimulai dari `docs/PRD.md` atau ADR (oleh pemilik), baru kemudian kode.
