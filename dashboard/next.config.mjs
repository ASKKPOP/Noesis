/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Grid API origin is controlled by NEXT_PUBLIC_GRID_ORIGIN (.env.example).
    // No rewrites: the dashboard calls the Grid directly via CORS (Plan 01).
};
export default nextConfig;
