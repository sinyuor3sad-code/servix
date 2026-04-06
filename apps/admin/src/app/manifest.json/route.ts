import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
