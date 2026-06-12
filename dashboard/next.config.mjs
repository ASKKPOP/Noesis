// Path hosting under the apex: NEXT_PUBLIC_BASE_PATH (e.g. "/dash") set at BUILD
// time serves the app under that prefix so it lives at noesiis.com/dash behind
// Traefik PathPrefix(`/dash`). Unset in dev → root. (api/traefik use subdomains;
// the web UIs use apex paths.)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: 'standalone',
    ...(basePath ? { basePath } : {}),
    // Clean URLs: pages never expose .html. /map serves the static orbital map
    // from /public; the old .html path permanently redirects to it.
    async redirects() {
        return [{ source: '/genesis-core-map.html', destination: '/map', permanent: true }];
    },
    async rewrites() {
        return [{ source: '/map', destination: '/genesis-core-map.html' }];
    },
    // Grid API origin is controlled by NEXT_PUBLIC_GRID_ORIGIN (.env.example).
    // Baked at BUILD time by the Docker build-arg flow — see docker/Dockerfile.dashboard.
    // No other rewrites: the dashboard calls the Grid directly via CORS (Plan 01).
    webpack(config) {
        // @metamask/sdk pulls in React Native storage; stub it out on web.
        config.resolve.alias['@react-native-async-storage/async-storage'] = false;
        return config;
    },
};
export default nextConfig;
