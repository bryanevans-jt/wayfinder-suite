import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wayfinder/branding", "@wayfinder/supabase", "@wayfinder/auth-ui"],
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
