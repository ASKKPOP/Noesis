/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    env: {
        NEXT_PUBLIC_GRID_ORIGIN: process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080',
    },
};
export default nextConfig;
