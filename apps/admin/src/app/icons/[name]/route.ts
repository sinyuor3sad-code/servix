import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const iconPath = path.join(process.cwd(), 'public', 'icons', name);
  
  try {
    if (fs.existsSync(iconPath)) {
      const buffer = fs.readFileSync(iconPath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
