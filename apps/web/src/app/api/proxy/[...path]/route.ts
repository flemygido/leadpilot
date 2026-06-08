import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const API_SECRET = process.env['INTERNAL_API_SECRET'] ?? '';

async function proxy(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.agentId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Reconstruct the target URL — strip the /api/proxy prefix
  const url = new URL(req.url);
  const targetPath = url.pathname.replace(/^\/api\/proxy/, '');
  const targetUrl = `${API_BASE}${targetPath}${url.search}`;

  const headers: Record<string, string> = {
    'X-Agent-Id': session.user.agentId,
    'X-Api-Secret': API_SECRET,
  };

  const contentType = req.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text()
    : undefined;

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    cache: 'no-store',
  });

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const PUT = proxy;
