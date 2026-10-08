#!/usr/bin/env bash
# Membuat label dan issue awal dari docs/tiket-awal/*.md. Jalankan SEKALI oleh pemilik.
# Syarat: gh CLI sudah login (gh auth login) dan dijalankan dari root repo.
# Setelah selesai, hapus folder docs/tiket-awal dan commit langsung ke main: GitHub Issues menjadi sumber kebenaran.
set -euo pipefail

buat_label() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null; echo "label: $1"; }
buat_label needs-triage     ededed "Perlu dievaluasi pemilik"
buat_label needs-info       d4c5f9 "Menunggu informasi/keputusan pemilik"
buat_label ready-for-agent  0e8a16 "Spesifikasi lengkap, siap dikerjakan agen"
buat_label ready-for-human  1d76db "Perlu dikerjakan dengan pendampingan manusia"
buat_label wontfix          ffffff "Tidak dikerjakan"
buat_label disetujui-pemilik b60205 "Pemilik menyetujui perubahan berkas terlindungi (hanya pemilik yang memasang)"
buat_label M0 c5def5 "Milestone 0: fondasi"
buat_label M1 c5def5 "Milestone 1: domain, impor, akses"
buat_label pelaksana:A fbca04 "Orang A (Claude Code)"
buat_label pelaksana:B fbca04 "Orang B (Claude Code)"
buat_label pelaksana:C fbca04 "Orang C (Codex)"

for f in docs/tiket-awal/T*.md; do
  title=$(head -n1 "$f" | sed 's/^# //')
  labels=$(sed -n '2p' "$f" | sed -E 's/<!-- labels: (.*) -->/\1/')
  body=$(tail -n +3 "$f")
  if gh issue list --state all --search "\"$title\" in:title" --json title --jq '.[].title' | grep -qxF "$title"; then
    echo "lewati (sudah ada): $title"; continue
  fi
  url=$(gh issue create --title "$title" --label "$labels" --body "$body")
  echo "dibuat: $title → $url"
done
