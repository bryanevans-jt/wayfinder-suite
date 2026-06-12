import { wayfinderSecurityHeaders } from "@wayfinder/branding/security-headers";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wayfinder/branding", "@wayfinder/supabase", "@wayfinder/auth-ui"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: wayfinderSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
