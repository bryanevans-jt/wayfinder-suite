import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wayfinder/branding", "@wayfinder/supabase", "@wayfinder/auth-ui"],
};

export default nextConfig;
