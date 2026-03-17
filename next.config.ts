import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp is a native Node.js module — must not be bundled by webpack/turbopack
  serverExternalPackages: ["sharp"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Existing public Supabase bucket (legacy products)
      { protocol: "https", hostname: "cszryoixzqtzikvgeksh.supabase.co" },
    ],
  },
};

export default nextConfig;
