import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect all routes except:
  // - static assets, images, favicons
  // - auth pages (/auth/signin, /auth/signup)
  // - NextAuth API routes (/api/auth/...)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|auth/|api/auth/).*)'],
};
