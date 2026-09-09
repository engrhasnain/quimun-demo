/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The API base is read at request time so the same build can point at a local
  // FastAPI process in development and a deployed one in production.
  env: {
    API_BASE: process.env.API_BASE || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000",
  },
};
export default nextConfig;
