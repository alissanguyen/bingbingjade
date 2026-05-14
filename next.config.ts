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
    // Product images are served via Supabase's Transform API (resize + WebP at CDN)
    // and carry unoptimized={true} individually — no Vercel quota used for them.
    // Static/local files (gallery, homepage sections) use Next.js optimization normally.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cszryoixzqtzikvgeksh.supabase.co" },
    ],
  },
};

export default nextConfig;
