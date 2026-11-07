import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() { // eslint-disable-line @typescript-eslint/require-await
    const apiUrl = process.env["API_URL"] ?? "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
