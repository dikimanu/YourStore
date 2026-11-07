import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Cloudinary delivery via custom loader (lib/cloudinaryLoader.ts)
    // Domains listed here as a fallback for unoptimised placeholder URLs
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        // placehold.co used by seed placeholder images
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
    // Disable Next.js built-in optimizer for Cloudinary images;
    // we do our own transformation in the custom loader.
    loader: "custom",
    loaderFile: "./lib/cloudinaryLoader.ts",
  },
  async rewrites() { // eslint-disable-line @typescript-eslint/require-await
    const apiUrl = process.env["API_URL"] ?? "http://localhost:4000";
    return [
      {
        // Don't proxy internal next.js api routes like /api/revalidate
        source: "/api/((?!revalidate).*)",
        destination: `${apiUrl}/api/$1`,
      },
    ];
  },
};

export default nextConfig;
