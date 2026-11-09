const { wayfinderSecurityHeaders } = require("@wayfinder/branding/security-headers");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wayfinder/auth-ui", "@wayfinder/branding", "@wayfinder/supabase"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: wayfinderSecurityHeaders(),
      },
    ];
  },
};

module.exports = nextConfig;
