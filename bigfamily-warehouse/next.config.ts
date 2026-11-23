import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  allowedDevOrigins: ["*.e2b.app"],
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  experimental: { cpus: 1 },
};
export default config;
