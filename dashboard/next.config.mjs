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
    // ONE map: /map and the old static .html both point to the rich 3D React
    // orbital station at /worldmap/orbital ("our world map" — live parcel feed,
    // seed fallback). The static genesis-core-map.html stays as the canonical
    // docs artifact but is no longer served as the app's map.
    async redirects() {
        return [
            { source: '/map', destination: '/worldmap/orbital', permanent: false },
            { source: '/genesis-core-map.html', destination: '/worldmap/orbital', permanent: false },
        ];
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
