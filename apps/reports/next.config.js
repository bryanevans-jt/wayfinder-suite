const { wayfinderSecurityHeaders } = require("@wayfinder/branding/security-headers");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wayfinder/auth-ui", "@wayfinder/branding", "@wayfinder/supabase"],
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
};

module.exports = nextConfig;
