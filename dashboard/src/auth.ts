/**
 * Auth.js v5 (next-auth@beta) configuration.
 *
 * Providers: Google OAuth, Apple OAuth.
 * The wallet/SIWE path is handled separately via the Grid API
 * and stored in Zustand (useHumanAuthStore), not in the NextAuth session.
 *
 * Required env vars (add to .env.local):
 *   AUTH_SECRET              — openssl rand -base64 32
 *   AUTH_GOOGLE_ID           — Google Cloud Console OAuth client ID
 *   AUTH_GOOGLE_SECRET       — Google Cloud Console OAuth client secret
 *   AUTH_APPLE_ID            — Apple Service ID (com.yourapp.signin)
 *   AUTH_APPLE_SECRET        — Apple-generated client secret JWT
 */

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId:     process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
        Apple({
            clientId:     process.env.AUTH_APPLE_ID,
            clientSecret: process.env.AUTH_APPLE_SECRET,
        }),
    ],
    pages: {
        signIn: '/portal/auth',
        error:  '/portal/auth',
    },
    callbacks: {
        async session({ session, token }) {
            if (token.sub) session.user.id = token.sub;
            return session;
        },
    },
});
