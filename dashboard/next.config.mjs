/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: 'standalone',
    // Grid API origin is controlled by NEXT_PUBLIC_GRID_ORIGIN (.env.example).
    // Baked at BUILD time by the Docker build-arg flow — see docker/Dockerfile.dashboard.
    // No rewrites: the dashboard calls the Grid directly via CORS (Plan 01).
};
export default nextConfig;
