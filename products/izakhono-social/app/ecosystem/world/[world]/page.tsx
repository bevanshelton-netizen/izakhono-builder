import Link from 'next/link';

type World = { name: string; purpose: string; activation: string; next: string; href?: string };

const worlds: Record<string, World> = {
  dotsee: { name: 'DOTSEE', purpose: 'Digital discovery and ecosystem footprint.', activation: 'hub-entry', next: 'Connect discovery, profiles, places, products and opportunities.' },
  'allegro-vibez': { name: 'Allegro Vibez', purpose: 'Music, radio, artists and entertainment.', activation: 'adapter-pending', next: 'Attach a verified media/content adapter when its endpoint and rights are verified.' },
  kora: { name: 'KORA', purpose: 'African content, culture and creators.', activation: 'adapter-pending', next: 'Attach verified KORA services and creator/content sources.' },
  yhvhh: { name: 'YHVH', purpose: 'Gospel, faith and worship.', activation: 'adapter-pending', next: 'Attach verified ministry/media services without assuming rights or endorsement.' },
  giving: { name: 'CONNECTA Giving', purpose: 'Good Samaritan fundraising.', activation: 'internal-module-pending', next: 'Connect verified campaigns, payment settlement and impact evidence.' },
  'adopt-a-spot': { name: 'Adopt-a-Spot', purpose: 'NPO, NGO and community adoption.', activation: 'internal-module-pending', next: 'Connect verified organisations, adoption commitments and evidence.' },
  benefits: { name: 'CONNECTA Benefits', purpose: 'Deals, coupons, competitions, giveaways and opportunities.', activation: 'internal-module-pending', next: 'Connect verified offers, terms, redemption and partner attribution.' },
  commerce: { name: 'CONNECTA Commerce', purpose: 'Businesses, products and services.', activation: 'internal-module-pending', next: 'Connect verified businesses, catalogues, enquiries and outcomes.' },
  vehicles: { name: 'Vehicles', purpose: 'Vehicle discovery and partner commerce.', activation: 'category-surface-pending', next: 'Connect structured inventory, seller verification, enquiries and partner feeds.' },
  nav: { name: 'IZAKHONO NAV', purpose: 'Mobility and driver safety.', activation: 'adapter-pending', next: 'Connect only verified navigation and safety services.' },
  one: { name: 'IZAKHONO ONE', purpose: 'AI, intelligence and business tooling.', activation: 'adapter-pending', next: 'Connect approved IZAKHONO intelligence services through owned control planes.' },
};

function statusLabel(activation: string) {
  const labels: Record<string, string> = {
    'hub-entry': 'HUB ENTRY',
    'adapter-pending': 'ADAPTER PENDING',
    'internal-module-pending': 'INTERNAL MODULE PENDING',
    'category-surface-pending': 'CATEGORY SURFACE PENDING',
  };
  return labels[activation] ?? activation.replaceAll('-', ' ').toUpperCase();
}

export default async function EcosystemWorldPage({ params }: { params: Promise<{ world: string }> }) {
  const { world } = await params;
  const item = worlds[world];
  if (!item) return <main style={{ padding: 40, fontFamily: 'Arial' }}><h1>World not found</h1><Link href="/ecosystem">Back to Ecosystem</Link></main>;
  return (
    <main style={{ minHeight: '100vh', background: '#06100d', color: '#f4fff9', fontFamily: 'Arial, sans-serif', padding: '48px 6vw' }}>
      <Link href="/ecosystem" style={{ color: '#64dfad', textDecoration: 'none' }}>← Ecosystem Hub</Link>
      <section style={{ maxWidth: 900, margin: '90px auto' }}>
        <span style={{ color: '#7fe0b5', letterSpacing: '.15em', fontSize: 12 }}>CONNECTA WORLD</span>
        <h1 style={{ fontSize: 'clamp(48px,8vw,88px)', lineHeight: .95, margin: '18px 0' }}>{item.name}</h1>
        <p style={{ fontSize: 22, lineHeight: 1.6, color: '#b8cfc5' }}>{item.purpose}</p>
        <div style={{ marginTop: 36, padding: 24, border: '1px solid #234b3d', borderRadius: 20, background: '#091b15' }}>
          <strong style={{ color: '#f2c879' }}>STATUS · {statusLabel(item.activation)}</strong>
          <p style={{ color: '#9eb8ad', lineHeight: 1.7 }}>{item.next}</p>
        </div>
        <div style={{ marginTop: 28, padding: 24, border: '1px solid #1d3a31', borderRadius: 20 }}>
          <strong>Verification gate</strong>
          <p style={{ color: '#9eb8ad', lineHeight: 1.7 }}>An adapter, partner, offer, charity, inventory source, payment outcome or external route is not represented as active until the relevant evidence gate passes.</p>
        </div>
      </section>
    </main>
  );
}
