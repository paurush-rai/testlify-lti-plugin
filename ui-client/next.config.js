/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiUrl = process.env.API_URL || "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/lti/:path*",
        destination: `${apiUrl}/lti/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
