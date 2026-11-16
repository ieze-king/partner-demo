import { NextResponse } from 'next/server';
import { getEnquiry } from '../../../../lib/getpropool';

// The status of one enquiry (the page asks every few seconds while it's waiting).
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ enquiry: await getEnquiry(id) });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status ?? 502 });
  }
}
