'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type DiscoveryRecord = {
  id: string;
  kind: string;
  category?: string | null;
  title?: string | null;
  description?: string | null;
  benefit?: string | null;
  provider?: string | null;
  price_display?: string | null;
  availability?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  price?: number | null;
  currency?: string | null;
  mileage?: number | null;
  transmission?: string | null;
  fuel?: string | null;
  body?: string | null;
  condition?: string | null;
  stock_reference?: string | null;
  location?: string | null;
  trust_status: string;
};

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  categories: string[];
  fields: string[];
  emptyTitle: string;
  emptyDescription: string;
  kind: 'benefit' | 'commerce' | 'vehicle';
  backHref?: string;
};

const ENGINE_URL = process.env.NEXT_PUBLIC_CONNECTA_ENGINE_URL || '';

export function DiscoverySurfaceClient({ eyebrow, title, description, categories, fields, emptyTitle, emptyDescription, kind, backHref = '/ecosystem' }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [records, setRecords] = useState<DiscoveryRecord[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  const endpoint = useMemo(() => {
    if (!ENGINE_URL) return '';
    const url = new URL('/v1/discovery', ENGINE_URL);
    url.searchParams.set('kind', kind);
    if (query.trim()) url.searchParams.set('q', query.trim());
    if (category) url.searchParams.set('category', category);
    url.searchParams.set('limit', '50');
    return url.toString();
  }, [category, kind, query]);

  useEffect(() => {
    let cancelled = false;
    if (!endpoint) {
      setState('unavailable');
      return () => { cancelled = true; };
    }
    setState('loading');
    fetch(endpoint, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Discovery unavailable')))
      .then((payload) => {
        if (cancelled) return;
        setRecords(Array.isArray(payload.records) ? payload.records : []);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setRecords([]);
          setState('unavailable');
        }
      });
    return () => { cancelled = true; };
  }, [endpoint]);

  return (
    <main style={{ minHeight: '100vh', background: '#06100d', color: '#f4fff9', fontFamily: 'Arial, sans-serif', padding: '34px 6vw 70px' }}>
      <Link href={backHref} style={{ color: '#64dfad', textDecoration: 'none', fontWeight: 800 }}>← Ecosystem Hub</Link>
      <section style={{ maxWidth: 1180, margin: '52px auto 0' }}>
        <span style={{ color: '#7fe0b5', letterSpacing: '.16em', fontSize: 11, fontWeight: 800 }}>{eyebrow}</span>
        <h1 style={{ fontSize: 'clamp(44px,7vw,78px)', lineHeight: .96, letterSpacing: '-.04em', margin: '16px 0' }}>{title}</h1>
        <p style={{ maxWidth: 820, fontSize: 20, lineHeight: 1.65, color: '#b8cfc5', margin: 0 }}>{description}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 18, marginTop: 38 }}>
          <form onSubmit={(event) => event.preventDefault()} style={{ padding: 22, border: '1px solid #234b3d', borderRadius: 20, background: '#091b15' }}>
            <label style={{ display: 'grid', gap: 8, color: '#dcefe8', fontSize: 12, fontWeight: 800 }}>
              Search this surface
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search verified listings and opportunities" style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #315c4e', background: '#06100d', color: '#f4fff9', outline: 'none' }} />
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setCategory('')} style={{ border: '1px solid #315c4e', background: category === '' ? '#17392d' : '#0d241d', color: '#cfe8df', borderRadius: 999, padding: '9px 12px', fontSize: 11, fontWeight: 800 }}>All</button>
              {categories.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} style={{ border: '1px solid #315c4e', background: category === item ? '#17392d' : '#0d241d', color: '#cfe8df', borderRadius: 999, padding: '9px 12px', fontSize: 11, fontWeight: 800 }}>{item}</button>)}
            </div>
          </form>

          <aside style={{ padding: 22, border: '1px solid #234b3d', borderRadius: 20, background: '#091b15' }}>
            <strong style={{ color: '#f2c879' }}>VERIFICATION STANDARD</strong>
            <p style={{ color: '#9eb8ad', lineHeight: 1.6, fontSize: 13 }}>Only verified records can be presented as active offers, inventory, partners or outcomes.</p>
            <div style={{ display: 'grid', gap: 8 }}>{fields.map((field) => <span key={field} style={{ color: '#b8cfc5', fontSize: 11, padding: '8px 10px', borderRadius: 10, background: '#0d241d' }}>{field}</span>)}</div>
          </aside>
        </div>

        {state === 'unavailable' && (
          <section style={{ marginTop: 20, padding: 30, border: '1px dashed #396657', borderRadius: 22, background: 'linear-gradient(145deg,#091b15,#07140f)' }}>
            <span style={{ color: '#7fe0b5', fontSize: 11, fontWeight: 900, letterSpacing: '.12em' }}>DISCOVERY ENGINE</span>
            <h2 style={{ fontSize: 28, margin: '10px 0 8px' }}>{emptyTitle}</h2>
            <p style={{ maxWidth: 760, color: '#9eb8ad', lineHeight: 1.7, margin: 0 }}>{emptyDescription}</p>
            <p style={{ color: '#f2c879', fontSize: 12, fontWeight: 800, marginTop: 18 }}>The public engine endpoint is not configured or reachable from this web runtime. No fake inventory is shown.</p>
          </section>
        )}

        {state === 'loading' && <section style={{ marginTop: 20, padding: 30, border: '1px solid #234b3d', borderRadius: 22, background: '#091b15' }}>Loading verified discovery…</section>}

        {state === 'ready' && records.length === 0 && <section style={{ marginTop: 20, padding: 30, border: '1px dashed #396657', borderRadius: 22, background: 'linear-gradient(145deg,#091b15,#07140f)' }}><h2 style={{ fontSize: 28, margin: 0 }}>{emptyTitle}</h2><p style={{ maxWidth: 760, color: '#9eb8ad', lineHeight: 1.7 }}>{emptyDescription}</p><p style={{ color: '#f2c879', fontSize: 12, fontWeight: 800 }}>No unverified placeholder listings are being shown.</p></section>}

        {records.length > 0 && <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14, marginTop: 20 }}>
          {records.map((record) => <article key={record.id} style={{ padding: 22, border: '1px solid #285243', borderRadius: 20, background: '#091b15' }}>
            <span style={{ color: '#7fe0b5', fontSize: 10, fontWeight: 900, letterSpacing: '.12em' }}>{record.category || record.kind} · VERIFIED</span>
            <h2 style={{ fontSize: 23, margin: '10px 0 8px' }}>{record.title || `${record.make || ''} ${record.model || ''}`.trim() || 'Verified listing'}</h2>
            <p style={{ color: '#aac4b9', lineHeight: 1.6, minHeight: 50 }}>{record.description || record.benefit || record.availability || 'Verified discovery record.'}</p>
            {kind === 'vehicle' && <p style={{ color: '#dcefe8', fontSize: 13 }}>{[record.year, record.mileage ? `${record.mileage.toLocaleString()} km` : '', record.transmission, record.fuel, record.location].filter(Boolean).join(' · ')}</p>}
            {kind === 'commerce' && <p style={{ color: '#dcefe8', fontSize: 13 }}>{record.price_display || record.availability || 'Enquire for verified availability'}</p>}
            {kind === 'benefit' && <p style={{ color: '#f2c879', fontSize: 13, fontWeight: 800 }}>{record.benefit || 'Verified benefit'}</p>}
            <p style={{ color: '#7fe0b5', fontSize: 11, marginBottom: 0 }}>Trust status: {record.trust_status}</p>
          </article>)}
        </section>}

        <section style={{ marginTop: 18, padding: 22, border: '1px solid #1d3a31', borderRadius: 20 }}>
          <strong>How CONNECTA protects discovery</strong>
          <p style={{ color: '#9eb8ad', lineHeight: 1.7, fontSize: 13, marginBottom: 0 }}>Submitted is not verified. Enquiry is not a sale. A promotion is not active until its terms are verified. A partner relationship is not claimed until an agreement is verified.</p>
        </section>
      </section>
    </main>
  );
}
