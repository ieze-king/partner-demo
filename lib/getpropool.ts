import 'server-only';
import type { Enquiry, Listing } from './types';

// The Getpropool Partner API, called from the server only: the API key is a password and must never
// reach the browser. Docs: https://api.getpropool.com/api/partner/docs

const BASE = (process.env.GETPROPOOL_API_URL || 'https://api.getpropool.com/api/partner/v1').replace(/\/$/, '');

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.GETPROPOOL_API_KEY;
  if (!key) throw new Error('GETPROPOOL_API_KEY is not set');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': key, ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error || body?.message || `Getpropool API ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body.data as T;
}

/** Every listing shared with partners (follows the pages). */
export async function fetchAllListings(): Promise<Listing[]> {
  const all: Listing[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await call<{ data: Listing[]; meta: { pages: number } }>(`/properties?limit=100&page=${page}`);
    all.push(...r.data);
    if (page >= (r.meta?.pages ?? 1)) break;
  }
  return all;
}

export function sendEnquiry(input: {
  propertyId: string; variantId?: string | null; buyerName: string; buyerPhone: string; buyerEmail?: string;
  message?: string; moveWhen?: string; consent: boolean; reference?: string;
}) {
  return call<Enquiry>('/enquiries', { method: 'POST', body: JSON.stringify(input) });
}

export function getEnquiry(id: string) {
  return call<Enquiry>(`/enquiries/${encodeURIComponent(id)}`);
}
