import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
