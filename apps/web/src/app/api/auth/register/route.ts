import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json() as { name?: string; phone?: string; email?: string; password?: string };

  const { name, phone, email, password } = body;
  if (!name || !phone || !email || !password) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const agent = await prisma.agent.create({
    data: { name, email, phone },
  });

  await prisma.user.create({
    data: { email, passwordHash, agentId: agent.id },
  });

  return NextResponse.json({ status: 'created' }, { status: 201 });
}
