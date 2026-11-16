import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { sendEnquiry } from '../../../lib/getpropool';

// A HomeHunt visitor is interested in a listing: send them to the lister through Getpropool.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!b.propertyId || !String(b.buyerName ?? '').trim() || !String(b.buyerPhone ?? '').trim()) {
    return NextResponse.json({ error: 'Name and WhatsApp number are required' }, { status: 400 });
  }
  if (b.consent !== true) return NextResponse.json({ error: 'Please agree to swap numbers with the lister' }, { status: 400 });
  try {
    const enquiry = await sendEnquiry({
      propertyId: b.propertyId,
      variantId: b.variantId || null,
      buyerName: String(b.buyerName).trim(),
      buyerPhone: String(b.buyerPhone).trim(),
      message: String(b.message ?? '').trim() || undefined,
      moveWhen: b.moveWhen || undefined,
      consent: true,
      // HomeHunt's own reference for it
      reference: `HH-${randomBytes(3).toString('hex').toUpperCase()}`,
    });
    return NextResponse.json({ enquiry });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.message }, { status: e.status && e.status < 500 ? e.status : 502 });
  }
}
