/** @type {import('next').NextConfig} */
const nextConfig = {
  // If we are using a reverse proxy, we might need to trust proxies or set assetPrefix
  // For now, simpler is better.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: process.env.API_URL
          ? `${process.env.API_URL}/api/:path*`
          : "http://localhost:4000/api/:path*", // Proxy API requests to backend
      },
      {
        // We also need to rewrite the /lti/ calls if we want next to proxy them?
        // No, the LMS launches DIRECTLY to the backend.
        // But the backend redirects to the frontend.
        // The frontend then makes API calls.
        source: "/lti/:path*",
        destination: "http://localhost:4000/lti/:path*", // Optional: if we want everything on one port (Next.js as gateway)
      },
    ];
  },
};

module.exports = nextConfig;
