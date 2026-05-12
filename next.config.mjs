/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` output bundles only the code + minimal deps the app needs at runtime.
  // Cuts the Docker image from ~1.2GB to ~250MB and avoids shipping the entire monorepo.
  // Required for ECS Fargate deploys; Vercel uses it automatically.
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.shopify.com" },
      { protocol: "https", hostname: "**.cdn.shopify.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "divainparfums.com" },
    ],
  },
};

export default nextConfig;
