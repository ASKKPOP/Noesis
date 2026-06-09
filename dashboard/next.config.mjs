// Single-apex path hosting: when NEXT_PUBLIC_BASE_PATH is set at BUILD time
// (e.g. "/dash"), the whole app is served under that prefix so it can live at
// noesiis.com/dash behind Traefik PathPrefix(`/dash`). Unset in dev → root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: 'standalone',
    ...(basePath ? { basePath } : {}),
    // Grid API origin is controlled by NEXT_PUBLIC_GRID_ORIGIN (.env.example).
    // Baked at BUILD time by the Docker build-arg flow — see docker/Dockerfile.dashboard.
    // No rewrites: the dashboard calls the Grid directly via CORS (Plan 01).
    webpack(config) {
        // @metamask/sdk pulls in React Native storage; stub it out on web.
        config.resolve.alias['@react-native-async-storage/async-storage'] = false;
        return config;
    },
};
export default nextConfig;
