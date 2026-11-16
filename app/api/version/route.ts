import { NextResponse } from 'next/server';
import { getVersion } from '../../../lib/store';

// Open pages ask every few seconds; when the number changes, they reload the listings.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ version: await getVersion() });
}
