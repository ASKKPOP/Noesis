// Path hosting under the apex: NEXT_PUBLIC_BASE_PATH (e.g. "/console") set at
// BUILD time serves the app under that prefix (noesiis.com/console behind
// Traefik PathPrefix(`/console`)). Unset in dev → root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    ...(basePath ? { basePath } : {}),
    env: {
        NEXT_PUBLIC_GRID_ORIGIN: process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080',
    },
};
export default nextConfig;
