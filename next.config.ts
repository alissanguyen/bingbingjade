import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp is a native Node.js module — must not be bundled by webpack/turbopack
  serverExternalPackages: ["sharp"],

  // Raise the body size limit for the image upload route (raw iPhone files can be 15–20 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },

  images: {
    // Supabase signed URLs change every ISR cycle, so Vercel can't cache them
    // and would burn through the free optimization quota. Product images carry
    // `unoptimized` individually. This global flag is intentionally removed so
    // that stable URLs (hero images from Unsplash) still get Vercel-optimized.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Existing public Supabase bucket (legacy products)
      { protocol: "https", hostname: "cszryoixzqtzikvgeksh.supabase.co" },
    ],
  },
};

export default nextConfig;
