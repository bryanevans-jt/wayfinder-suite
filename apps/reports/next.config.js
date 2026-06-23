/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wayfinder/branding", "@wayfinder/supabase"],
};

module.exports = nextConfig;
