import { wayfinderSecurityHeaders } from "@wayfinder/branding/security-headers";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wayfinder/branding", "@wayfinder/supabase", "@wayfinder/auth-ui"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(.*)",
        headers: wayfinderSecurityHeaders(),
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard/employer-network",
        destination: "/dashboard/community-partners",
        permanent: true,
      },
      {
        source: "/dashboard/employer-network/:id",
        destination: "/dashboard/community-partners/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
