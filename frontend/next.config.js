/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow images from external domains
  images: {
    domains: [
      'agrovolt-backend.onrender.com',
      'localhost',
    ],
    remotePatterns: [
      { protocol: 'https', hostname: '**.onrender.com' },
    ],
  },

  // Environment variable passthrough
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001',
  },
}

module.exports = nextConfig
