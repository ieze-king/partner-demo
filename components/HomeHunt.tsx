'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityItem, Enquiry, Listing } from '../lib/types';

// HomeHunt (demo): a partner site built on the Getpropool Partner API. It shows the shared listings,
// refreshes the moment Getpropool sends a webhook, and sends interested visitors to the lister.

const POLL_MS = 3000;
const ENQUIRIES_KEY = 'homehunt_enquiries';

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;
const PER: Record<string, string> = { rent: '/yr', shortlet: '/night', sale: '' };
const DEAL: Record<string, string> = { rent: 'For rent', sale: 'For sale', shortlet: 'Short let' };
const EVENT_LABEL: Record<string, string> = {
  'property.published': 'New listing',
  'property.updated': 'Listing updated',
  'property.vacancy_changed': 'Availability changed',
  'property.unpublished': 'Listing removed',
  'enquiry.updated': 'Enquiry answered',
};
const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};
const place = (l: Listing) => [l.neighbourhoodName, l.city, l.state].filter((x, i, a) => x && a.indexOf(x) === i).join(', ');

function loadEnquiries(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(ENQUIRIES_KEY) || '{}'); } catch { return {}; }
}
function saveEnquiry(propertyId: string, enquiryId: string) {
  try { localStorage.setItem(ENQUIRIES_KEY, JSON.stringify({ ...loadEnquiries(), [propertyId]: enquiryId })); } catch { /* private mode */ }
}

export default function HomeHunt() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [usingRedis, setUsingRedis] = useState(true);
  const [deal, setDeal] = useState<'all' | 'rent' | 'sale'>('all');
  const [state, setState] = useState('');
  const [open, setOpen] = useState<Listing | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const version = useRef<number | null>(null);
  const known = useRef<Map<string, string>>(new Map());

  const load = useCallback(async (announce: boolean) => {
    const r = await fetch('/api/listings', { cache: 'no-store' });
    const d = await r.json();
    const next: Listing[] = d.listings;
    // Which cards changed since last time, to highlight them
    const changed = new Set<string>();
    for (const l of next) if (known.current.get(l.id) !== l.updatedAt) changed.add(l.id);
    if (announce && known.current.size) {
      setFlash(changed);
      const latest: ActivityItem | undefined = d.activity?.[0];
      if (latest) {
        // From Getpropool sending the change to it showing on this page
        const onScreen = latest.sentAt ? ` ${((Date.now() - Date.parse(latest.sentAt)) / 1000).toFixed(1)}s after the change on Getpropool` : '';
        setToast(`${EVENT_LABEL[latest.event] ?? latest.event}${latest.title ? `: ${latest.title}` : ''}. On screen${onScreen}`);
      }
    }
    known.current = new Map(next.map(l => [l.id, l.updatedAt]));
    version.current = d.version;
    setListings(next);
    setActivity(d.activity ?? []);
    setWarning(d.warning);
    setUsingRedis(d.usingRedis);
    // Keep an open listing in step; close it if the listing went away
    setOpen(o => (o ? next.find(l => l.id === o.id) ?? null : o));
  }, []);

  useEffect(() => { load(false).catch(() => setWarning('Could not load listings')); }, [load]);

  // Ask every few seconds whether anything changed; reload only when it did
  useEffect(() => {
    const t = setInterval(async () => {
      // A page in a background tab doesn't need to check
      if (document.visibilityState === 'hidden') return;
      try {
        const r = await fetch('/api/version', { cache: 'no-store' });
        const { version: v } = await r.json();
        setLive(true);
        if (version.current !== null && v !== version.current) await load(true);
      } catch { setLive(false); }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!flash.size) return;
    const t = setTimeout(() => setFlash(new Set()), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  const states = useMemo(() => [...new Set((listings ?? []).map(l => l.state).filter(Boolean) as string[])].sort(), [listings]);
  const shown = useMemo(() => (listings ?? []).filter(l =>
    (deal === 'all' || l.listingType === deal) && (!state || l.state === state)), [listings, deal, state]);

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div className="logo"><span className="logo-mark">H</span> HomeHunt</div>
          <span className="demo-tag">Demo partner site · listings from the Getpropool API</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <h1>Find your next home</h1>
          <p>Verified homes from developers and property managers, updated the moment they change.</p>
          <div className="filters">
            {(['all', 'rent', 'sale'] as const).map(d => (
              <button key={d} className={`chip ${deal === d ? 'on' : ''}`} onClick={() => setDeal(d)}>
                {d === 'all' ? 'All homes' : d === 'rent' ? 'For rent' : 'For sale'}
              </button>
            ))}
            <select value={state} onChange={e => setState(e.target.value)} aria-label="State">
              <option value="">Anywhere</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </section>

      <main className="wrap">
        <div>
          {warning && <div className="warn">{warning}</div>}
          {!usingRedis && <div className="warn">Running without a database: fine on your computer, but on Vercel connect Upstash Redis so updates are kept.</div>}
          {listings === null && <div className="empty">Loading homes…</div>}
          {listings && shown.length === 0 && <div className="empty">No homes here yet. Approve a listing on Getpropool and watch it appear.</div>}
          <div className="grid">
            {shown.map(l => (
              <button key={l.id} className={`card ${flash.has(l.id) ? 'flash' : ''}`} onClick={() => setOpen(l)}>
                <div className="card-img" style={{ backgroundImage: l.photoUrls[0] ? `url("${l.photoUrls[0]}")` : undefined }}>
                  <span className="badge">{l.listingTypeLabel ?? (l.listingType ? DEAL[l.listingType] : null) ?? 'Available'}</span>
                </div>
                <div className="card-body">
                  <div className="price">{l.price ? naira(l.price) : 'Price on request'} <small>{l.listingType ? PER[l.listingType] : ''}</small></div>
                  <div className="title">{l.title}</div>
                  <div className="meta">{[l.propertyTypeLabel, l.bedrooms ? `${l.bedrooms} bed` : null, l.bathrooms ? `${l.bathrooms} bath` : null, place(l)].filter(Boolean).join(' · ')}</div>
                  {l.organization && <div className="via">Listed by {l.organization.name}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="panel" aria-live="polite">
          <h2><span className={`dot ${live ? '' : 'off'}`} /> Live from Getpropool</h2>
          <p className="sub">Every change on Getpropool arrives here by webhook. This page refreshes on its own.</p>
          {activity.length === 0 && <p className="sub">Nothing yet. Approve, edit or remove a listing on Getpropool.</p>}
          {activity.map((a, i) => (
            <div className="ev" key={`${a.receivedAt}-${i}`}>
              <b>{EVENT_LABEL[a.event] ?? a.event}</b>{a.title ? `: ${a.title}` : ''}
              <div className="t">{ago(a.receivedAt)}{a.delayMs != null && <> · <span className="d">arrived in {(a.delayMs / 1000).toFixed(1)}s</span></>}</div>
            </div>
          ))}
        </aside>
      </main>

      <p className="foot">HomeHunt is a demonstration site, not a real company. Homes and enquiries are handled by Getpropool and the people who listed them.</p>

      {open && <ListingModal listing={open} onClose={() => setOpen(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function ListingModal({ listing: l, onClose }: { listing: Listing; onClose: () => void }) {
  const [photo, setPhoto] = useState(0);
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const photos = l.photoUrls.length ? l.photoUrls : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // A visitor who already asked about this home sees where it stands
  useEffect(() => {
    const id = loadEnquiries()[l.id];
    if (!id) return;
    fetch(`/api/enquiries/${id}`).then(r => r.json()).then(d => d.enquiry && setEnquiry(d.enquiry)).catch(() => {});
  }, [l.id]);

  // While it's waiting, check every few seconds for the lister's answer
  useEffect(() => {
    if (enquiry?.status !== 'waiting') return;
    const t = setInterval(() => {
      fetch(`/api/enquiries/${enquiry.id}`).then(r => r.json()).then(d => d.enquiry && setEnquiry(d.enquiry)).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [enquiry]);

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={l.title}>
        <div className="modal-img" style={{ backgroundImage: photos[photo] ? `url("${photos[photo]}")` : undefined }}>
          <button className="close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {photos.length > 1 && (
          <div className="thumbs">
            {photos.map((p, i) => <button key={p} className={i === photo ? 'on' : ''} style={{ backgroundImage: `url("${p}")` }} onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`} />)}
          </div>
        )}
        <div className="modal-body">
          <div className="price">{l.price ? naira(l.price) : 'Price on request'} <small>{l.listingType ? PER[l.listingType] : ''}</small></div>
          <h3>{l.title}</h3>
          <div className="meta">{place(l)}{l.organization ? ` · Listed by ${l.organization.name}` : ''}</div>
          <div className="facts">
            <span className="fact">{l.listingTypeLabel ?? (l.listingType ? DEAL[l.listingType] : null) ?? 'Available'}</span>
            {l.propertyTypeLabel ? <span className="fact">{l.propertyTypeLabel}</span> : null}
            {l.bedrooms ? <span className="fact">{l.bedrooms} bedrooms</span> : null}
            {l.bathrooms ? <span className="fact">{l.bathrooms} bathrooms</span> : null}
            {l.furnished ? <span className="fact">Furnished</span> : null}
            {(l.features ?? []).slice(0, 6).map(f => <span className="fact" key={f}>{f}</span>)}
          </div>
          {l.description && <p className="desc">{l.description}</p>}
          {l.variants && l.variants.length > 0 && (
            <div className="units">
              {l.variants.map(v => (
                <div className="unit" key={v.id}><span>{v.title}{v.bedrooms ? ` · ${v.bedrooms} bed` : ''}</span><b>{v.price ? naira(v.price) : ''}</b></div>
              ))}
            </div>
          )}

          {enquiry ? <EnquiryStatus enquiry={enquiry} /> : l.enquiriesOpen ? (
            <InterestForm listing={l} onSent={e => { saveEnquiry(l.id, e.id); setEnquiry(e); }} />
          ) : (
            <p className="sub" style={{ marginTop: 14 }}>Enquiries are not open for this home.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function InterestForm({ listing, onSent }: { listing: Listing; onSent: (e: Enquiry) => void }) {
  const [form, setForm] = useState({ buyerName: '', buyerPhone: '', message: 'Is it still available? When can I inspect?', moveWhen: 'now', variantId: '' });
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setError('');
    try {
      const r = await fetch('/api/enquiries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, propertyId: listing.id, consent }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not send');
      onSent(d.enquiry);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="form" onSubmit={send}>
      <b>I&apos;m interested</b>
      {listing.variants && listing.variants.length > 1 && (
        <label>Which unit?
          <select value={form.variantId} onChange={set('variantId')}>
            <option value="">Any</option>
            {listing.variants.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        </label>
      )}
      <label>Your name<input required value={form.buyerName} onChange={set('buyerName')} placeholder="Ada Obi" /></label>
      <label>Your WhatsApp number<input required inputMode="tel" value={form.buyerPhone} onChange={set('buyerPhone')} placeholder="0803 123 4567" /></label>
      <label>When do you want to move?
        <select value={form.moveWhen} onChange={set('moveWhen')}>
          <option value="now">As soon as possible</option>
          <option value="1_3_months">In 1 to 3 months</option>
          <option value="3_6_months">In 3 to 6 months</option>
          <option value="exploring">Just looking</option>
        </select>
      </label>
      <label>Message<textarea rows={2} value={form.message} onChange={set('message')} /></label>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        If the home is available, I agree to swap WhatsApp numbers with the lister.
      </label>
      {error && <p className="err">{error}</p>}
      <button className="btn" disabled={sending || !consent}>{sending ? 'Sending…' : 'Send to the lister'}</button>
    </form>
  );
}

function EnquiryStatus({ enquiry: e }: { enquiry: Enquiry }) {
  if (e.status === 'waiting') {
    return (
      <div className="status waiting">
        <b>Sent to {e.listerName ?? 'the lister'}</b>
        Waiting for their reply. This updates on its own. (Your reference: {e.reference})
      </div>
    );
  }
  if (e.status === 'available') {
    const wa = e.listerWhatsapp
      ? `https://wa.me/${e.listerWhatsapp.replace(/\D/g, '').replace(/^0/, '234')}?text=${encodeURIComponent(`Hi, I found your ${e.headline} on HomeHunt. I'd like to arrange an inspection.`)}`
      : null;
    return (
      <div className="status ok">
        <b>Good news: it&apos;s available</b>
        {e.listerName ?? 'The lister'} replied: &ldquo;{e.listerReply}&rdquo;
        {wa && <div><a className="btn navy" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp {e.listerName ?? 'the lister'}</a></div>}
      </div>
    );
  }
  return (
    <div className="status no">
      <b>{e.status === 'unavailable' ? 'Sorry, this home is no longer available' : e.status === 'expired' ? 'The lister did not reply in time' : 'You withdrew this enquiry'}</b>
      Have a look at the other homes on HomeHunt.
    </div>
  );
}
