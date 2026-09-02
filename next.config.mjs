/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@cursor/sdk'],
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
