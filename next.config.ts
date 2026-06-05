import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.modrinth.com" },
      { protocol: "https", hostname: "**.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
