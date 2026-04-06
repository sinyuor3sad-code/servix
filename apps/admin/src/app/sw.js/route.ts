import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const swPath = path.join(process.cwd(), 'public', 'sw.js');
  try {
    const content = fs.readFileSync(swPath, 'utf-8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Service-Worker-Allowed': '/',
      },
    });
  } catch {
    return new NextResponse('// SW not found', {
      status: 404,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
}
