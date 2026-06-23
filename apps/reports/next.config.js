/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wayfinder/auth-ui", "@wayfinder/branding", "@wayfinder/supabase"],
};

module.exports = nextConfig;
