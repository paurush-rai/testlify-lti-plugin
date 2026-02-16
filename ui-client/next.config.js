/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "ltijs",
      "ltijs-sequelize",
      "sequelize",
      "pg",
      "pg-hstore",
    ],
  },
};

module.exports = nextConfig;
