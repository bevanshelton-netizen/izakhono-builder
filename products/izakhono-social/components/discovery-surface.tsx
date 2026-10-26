import Link from 'next/link';

type DiscoverySurfaceProps = {
  eyebrow: string;
  title: string;
  description: string;
  categories: string[];
  fields: string[];
  emptyTitle: string;
  emptyDescription: string;
  backHref?: string;
};

export function DiscoverySurface({ eyebrow, title, description, categories, fields, emptyTitle, emptyDescription, backHref = '/ecosystem' }: DiscoverySurfaceProps) {
  return (
    <main style={{ minHeight: '100vh', background: '#06100d', color: '#f4fff9', fontFamily: 'Arial, sans-serif', padding: '34px 6vw 70px' }}>
      <Link href={backHref} style={{ color: '#64dfad', textDecoration: 'none', fontWeight: 800 }}>← Ecosystem Hub</Link>
      <section style={{ maxWidth: 1180, margin: '52px auto 0' }}>
        <span style={{ color: '#7fe0b5', letterSpacing: '.16em', fontSize: 11, fontWeight: 800 }}>{eyebrow}</span>
        <h1 style={{ fontSize: 'clamp(44px,7vw,78px)', lineHeight: .96, letterSpacing: '-.04em', margin: '16px 0' }}>{title}</h1>
        <p style={{ maxWidth: 820, fontSize: 20, lineHeight: 1.65, color: '#b8cfc5', margin: 0 }}>{description}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 18, marginTop: 38 }}>
          <form method="get" style={{ padding: 22, border: '1px solid #234b3d', borderRadius: 20, background: '#091b15' }}>
            <label style={{ display: 'grid', gap: 8, color: '#dcefe8', fontSize: 12, fontWeight: 800 }}>
              Search this surface
              <input name="q" placeholder="Search verified listings and opportunities" style={{ width: '100%', padding: '13px 14px', borderRadius: 12, border: '1px solid #315c4e', background: '#06100d', color: '#f4fff9', outline: 'none' }} />
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {categories.map((category) => <button key={category} name="category" value={category} style={{ border: '1px solid #315c4e', background: '#0d241d', color: '#cfe8df', borderRadius: 999, padding: '9px 12px', fontSize: 11, fontWeight: 800 }}>{category}</button>)}
            </div>
          </form>

          <aside style={{ padding: 22, border: '1px solid #234b3d', borderRadius: 20, background: '#091b15' }}>
            <strong style={{ color: '#f2c879' }}>VERIFICATION STANDARD</strong>
            <p style={{ color: '#9eb8ad', lineHeight: 1.6, fontSize: 13 }}>Only verified records can be presented as active offers, inventory, partners or outcomes.</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {fields.map((field) => <span key={field} style={{ color: '#b8cfc5', fontSize: 11, padding: '8px 10px', borderRadius: 10, background: '#0d241d' }}>{field}</span>)}
            </div>
          </aside>
        </div>

        <section style={{ marginTop: 20, padding: 30, border: '1px dashed #396657', borderRadius: 22, background: 'linear-gradient(145deg,#091b15,#07140f)' }}>
          <span style={{ color: '#7fe0b5', fontSize: 11, fontWeight: 900, letterSpacing: '.12em' }}>VERIFIED DISCOVERY INVENTORY</span>
          <h2 style={{ fontSize: 28, margin: '10px 0 8px' }}>{emptyTitle}</h2>
          <p style={{ maxWidth: 760, color: '#9eb8ad', lineHeight: 1.7, margin: 0 }}>{emptyDescription}</p>
          <p style={{ color: '#f2c879', fontSize: 12, fontWeight: 800, marginTop: 18 }}>No unverified placeholder listings are being shown.</p>
        </section>

        <section style={{ marginTop: 18, padding: 22, border: '1px solid #1d3a31', borderRadius: 20 }}>
          <strong>How CONNECTA protects discovery</strong>
          <p style={{ color: '#9eb8ad', lineHeight: 1.7, fontSize: 13, marginBottom: 0 }}>Submitted is not verified. Enquiry is not a sale. A promotion is not active until its terms are verified. A partner relationship is not claimed until an agreement is verified.</p>
        </section>
      </section>
    </main>
  );
}
