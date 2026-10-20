import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // Image Docker produksi (T130) hanya menyalin hasil build mandiri ini, tanpa node_modules penuh.
  output: "standalone",
  // T137: `next dev` mencatat argumen setiap server action ke log, termasuk kata sandi (buat pengguna, atur ulang kata
  // sandi). Kata sandi tidak boleh ditulis ke log (PRD A3 ▶ Keputusan 2026-10-20).
  logging: { serverFunctions: false },
};

export default nextConfig;
