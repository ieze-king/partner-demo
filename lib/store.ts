import 'server-only';
import { Redis } from '@upstash/redis';
import type { ActivityItem, Listing } from './types';

// This site's own copy of the listings, kept up to date by Getpropool's webhooks, plus a version
// number the open pages watch so they refresh the moment something changes. On Vercel it lives in
// Upstash Redis (servers there forget everything between requests); locally, in memory.

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const K = { listings: 'hh:listings', version: 'hh:version', syncedAt: 'hh:syncedAt', activity: 'hh:activity' };

// In-memory fallback for local runs
const mem = globalThis as unknown as { __hh?: { listings: Map<string, Listing>; version: number; syncedAt: number; activity: ActivityItem[] } };
mem.__hh ??= { listings: new Map(), version: 0, syncedAt: 0, activity: [] };
const m = mem.__hh;

export const usingRedis = !!redis;

export async function getListings(): Promise<Listing[]> {
  if (!redis) return [...m.listings.values()];
  const h = await redis.hgetall<Record<string, Listing>>(K.listings);
  return h ? Object.values(h) : [];
}

export async function replaceListings(list: Listing[]) {
  if (!redis) {
    m.listings = new Map(list.map(l => [l.id, l]));
    m.syncedAt = Date.now();
    return;
  }
  const p = redis.pipeline();
  p.del(K.listings);
  if (list.length) p.hset(K.listings, Object.fromEntries(list.map(l => [l.id, l])));
  p.set(K.syncedAt, Date.now());
  await p.exec();
}

export async function upsertListing(l: Listing) {
  if (!redis) { m.listings.set(l.id, l); return; }
  await redis.hset(K.listings, { [l.id]: l });
}

export async function removeListing(id: string) {
  if (!redis) { m.listings.delete(id); return; }
  await redis.hdel(K.listings, id);
}

export async function syncedAt(): Promise<number> {
  if (!redis) return m.syncedAt;
  return Number((await redis.get<number>(K.syncedAt)) ?? 0);
}

export async function getVersion(): Promise<number> {
  if (!redis) return m.version;
  return Number((await redis.get<number>(K.version)) ?? 0);
}

export async function bumpVersion(): Promise<number> {
  if (!redis) return ++m.version;
  return redis.incr(K.version);
}

export async function addActivity(item: ActivityItem) {
  if (!redis) { m.activity = [item, ...m.activity].slice(0, 20); return; }
  await redis.lpush(K.activity, item);
  await redis.ltrim(K.activity, 0, 19);
}

export async function getActivity(): Promise<ActivityItem[]> {
  if (!redis) return m.activity;
  return (await redis.lrange<ActivityItem>(K.activity, 0, 19)) ?? [];
}
