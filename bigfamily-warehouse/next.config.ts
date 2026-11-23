import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  allowedDevOrigins: ["*.e2b.app"],
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // The warehouse initializes its database from this SQL file at runtime.
  // Include it in each serverless API bundle so /api/* does not fail with ENOENT.
  outputFileTracingIncludes: {
    "/api/**/*": ["./sql/schema.sql"],
  },
  experimental: { cpus: 1 },
};
export default config;
