import type { NextAuthConfig } from 'next-auth';

// Minimal config for middleware/Edge — no DB calls
// The full credentials provider is only used in auth.ts (Node.js)
export const authConfig: NextAuthConfig = {
  secret: process.env['AUTH_SECRET'],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  providers: [],
  callbacks: {
    authorized: ({ auth }) => !!auth,
  },
};
