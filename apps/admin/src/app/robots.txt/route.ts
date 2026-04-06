import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('User-agent: *\nDisallow: /', {
    headers: { 'Content-Type': 'text/plain' },
  });
}
