import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict mode for development
  reactStrictMode: true,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: "UGC Logistics Dashboard",
  },
};

export default nextConfig;
