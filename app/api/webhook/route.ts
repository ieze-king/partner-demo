import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { addActivity, bumpVersion, removeListing, upsertListing } from '../../../lib/store';
import type { Listing } from '../../../lib/types';

// Getpropool calls this address when a listing appears, changes or goes away, and when one of our
// enquiries changes. Register it in the Getpropool Partner Portal → Webhooks.

export const dynamic = 'force-dynamic';

function validSignature(raw: string, header: string | null) {
  const secret = process.env.GETPROPOOL_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get('x-getpropool-signature'))) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 });
  }
  const { event, data, timestamp } = JSON.parse(raw) as { event: string; data: { id: string; listing?: Listing; headline?: string }; timestamp?: string };

  if (event === 'property.published' || event === 'property.updated' || event === 'property.vacancy_changed') {
    if (data.listing) await upsertListing(data.listing);
  } else if (event === 'property.unpublished') {
    await removeListing(data.id);
  }

  const receivedAt = new Date();
  await addActivity({
    event,
    id: data.id,
    title: data.listing?.title ?? data.headline ?? null,
    sentAt: timestamp ?? null,
    receivedAt: receivedAt.toISOString(),
    delayMs: timestamp ? Math.max(0, receivedAt.getTime() - Date.parse(timestamp)) : null,
  });
  await bumpVersion();
  return NextResponse.json({ ok: true });
}
