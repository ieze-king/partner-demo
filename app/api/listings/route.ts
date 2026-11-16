import { NextResponse } from 'next/server';
import { fetchAllListings } from '../../../lib/getpropool';
import { getActivity, getListings, getVersion, replaceListings, syncedAt, usingRedis } from '../../../lib/store';

// The listings this site shows. Webhooks keep the copy current; as a safety net it re-reads
// everything from Getpropool at most once a minute, so a missed webhook never leaves it wrong for long.

export const dynamic = 'force-dynamic';
const RESYNC_MS = 60_000;

export async function GET() {
  let warning: string | null = null;
  if (Date.now() - (await syncedAt()) > RESYNC_MS) {
    try {
      await replaceListings(await fetchAllListings());
    } catch (err) {
      warning = `Could not reach Getpropool: ${(err as Error).message}`;
    }
  }
  const [listings, version, activity, last] = await Promise.all([getListings(), getVersion(), getActivity(), syncedAt()]);
  listings.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return NextResponse.json({ listings, version, activity, syncedAt: last, usingRedis, warning });
}
