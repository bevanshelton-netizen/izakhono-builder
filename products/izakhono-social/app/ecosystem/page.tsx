import Link from 'next/link';

const worlds = [
  { icon: '◎', name: 'CONNECTA Social', tag: 'People · Communities · Conversation', href: '/', tone: 'social', description: 'Post, reply, follow, message, build communities and control how you discover conversation.' },
  { icon: '◉', name: 'DOTSEE', tag: 'Discovery · Digital Footprint', href: '/ecosystem', tone: 'discover', description: 'A visual front door to the IZAKHONO digital universe and the people, products and opportunities inside it.' },
  { icon: '♫', name: 'Allegro Vibez', tag: 'Music · Radio · Entertainment', href: '/ecosystem', tone: 'music', description: 'Discover artists, music, radio, entertainment and communities without leaving the CONNECTA ecosystem.' },
  { icon: '◇', name: 'KORA', tag: 'African Content · Culture', href: '/ecosystem', tone: 'kora', description: 'A home for African stories, creators, culture, media and opportunity.' },
  { icon: '✝', name: 'YHVH', tag: 'Gospel · Faith · Worship', href: '/ecosystem', tone: 'faith', description: 'Discover Gospel programmes, ministries, worship, Christian creators and faith communities.' },
  { icon: '♥', name: 'Giving', tag: 'Good Samaritans · Fundraising', href: '/ecosystem', tone: 'giving', description: 'Help change lives through verified campaigns, transparent giving and measurable impact.' },
  { icon: '✦', name: 'Adopt-a-Spot', tag: 'NPOs · NGOs · Communities', href: '/ecosystem', tone: 'impact', description: 'Adopt an organisation, project or community and follow the journey from commitment to evidence.' },
  { icon: '🎁', name: 'Benefits', tag: 'Deals · Freebies · Opportunities', href: '/ecosystem', tone: 'benefits', description: 'Coupons, competitions, giveaways, travel deals, partner benefits and genuinely useful free opportunities.' },
  { icon: '▣', name: 'Commerce', tag: 'Buy · Sell · Business', href: '/ecosystem', tone: 'commerce', description: 'Discover verified businesses, products, services, vehicles, property, jobs and opportunities.' },
  { icon: '🚗', name: 'Vehicles', tag: 'Cars · Imports · Services', href: '/ecosystem', tone: 'vehicles', description: 'A dedicated vehicle discovery surface with verified sellers, inventory, enquiries and partner offers.' },
  { icon: '◈', name: 'IZAKHONO NAV', tag: 'Mobility · Safety', href: '/ecosystem', tone: 'nav', description: 'Safety-first navigation, emergency response, driver intelligence and African road intelligence.' },
  { icon: '⚡', name: 'IZAKHONO ONE', tag: 'AI · Intelligence · Work', href: '/ecosystem', tone: 'one', description: 'The intelligence layer connecting search, AI, business tools, cloud, commerce and the wider IZAKHONO stack.' },
];

const categories = ['Vehicles', 'Property', 'Jobs & Careers', 'Business & Services', 'Shopping & Products', 'Technology', 'Sports', 'Music & Entertainment', 'Education & Training', 'News & Community', 'Travel & Hospitality', 'Food & Lifestyle', 'Agriculture', 'Finance & Opportunities', 'Government & Public Services', 'Faith & Culture', 'Arts & Creativity', 'Health & Wellness', 'Events'];

export default function EcosystemPage() {
  return (
    <main className="ecoPage">
      <section className="ecoHero">
        <div className="ecoTop"><Link href="/" className="ecoBrand"><span className="ecoMark">I</span><span>IZAKHONO</span></Link><span className="ecoPill">ONE ECOSYSTEM · MANY WORLDS</span></div>
        <div className="ecoHeroGrid">
          <div>
            <span className="ecoEyebrow">CONNECTA ECOSYSTEM HUB</span>
            <h1>Everything useful.<br/><em>One connected place.</em></h1>
            <p>Social connection, culture, faith, entertainment, commerce, benefits, giving, opportunity, mobility and intelligence — brought together through one IZAKHONO identity.</p>
            <div className="ecoActions"><Link href="/" className="ecoPrimary">Enter CONNECTA</Link><a href="#worlds" className="ecoSecondary">Explore the ecosystem ↓</a></div>
          </div>
          <div className="ecoOrbit" aria-label="IZAKHONO ecosystem visual">
            <div className="ecoCore">I<span>ZAKHONO</span></div>
            <div className="ecoNode n1">CONNECTA</div><div className="ecoNode n2">DOTSEE</div><div className="ecoNode n3">KORA</div><div className="ecoNode n4">YHVH</div><div className="ecoNode n5">GIVING</div><div className="ecoNode n6">COMMERCE</div>
          </div>
        </div>
      </section>

      <section id="worlds" className="ecoSection">
        <div className="ecoSectionHead"><div><span className="ecoEyebrow">THE WORLDS</span><h2>One identity. Different experiences.</h2></div><p>Each world keeps its own purpose and brand while sharing the ecosystem&apos;s trust, discovery and control layer.</p></div>
        <div className="ecoGrid">{worlds.map((w) => <Link href={w.href} className={`ecoCard ${w.tone}`} key={w.name}><div className="ecoIcon">{w.icon}</div><span className="ecoTag">{w.tag}</span><h3>{w.name}</h3><p>{w.description}</p><span className="ecoOpen">Explore →</span></Link>)}</div>
      </section>

      <section className="ecoBenefits">
        <div><span className="ecoEyebrow">THE PROMISE</span><h2>Make the internet more useful to ordinary people.</h2><p>Find something. Learn something. Meet someone. Save money. Build a business. Discover opportunity. Give. Receive help. Stay safe. Create.</p></div>
        <div className="ecoPromise"><strong>CONNECT</strong><span>people & communities</span><strong>DISCOVER</strong><span>information & opportunity</span><strong>PROSPER</strong><span>commerce & growth</span><strong>GIVE</strong><span>service & impact</span></div>
      </section>

      <section className="ecoSection ecoCategories"><div className="ecoSectionHead"><div><span className="ecoEyebrow">DISCOVERY INDEX</span><h2>Categories built around real life.</h2></div><p>Every major category gets a dedicated discovery surface rather than disappearing into an endless feed.</p></div><div className="ecoCategoryGrid">{categories.map((c) => <span key={c}>{c}</span>)}</div></section>

      <section className="ecoTrust"><span className="ecoEyebrow">TRUST BY DESIGN</span><h2>No badge without evidence.</h2><div className="ecoTrustGrid"><div><b>Verified partners</b><span>Agreement and identity evidence before official claims.</span></div><div><b>Verified giving</b><span>Settlement and impact evidence before donation claims.</span></div><div><b>Verified offers</b><span>Terms, dates and redemption conditions are checked.</span></div><div><b>Human freedom</b><span>Ordinary lawful expression is not paywalled for monetisation.</span></div></div></section>

      <footer className="ecoFooter"><div><span className="ecoMark">I</span><strong>IZAKHONO</strong></div><p>One ecosystem. Many worlds. One identity.</p><Link href="/">← Back to CONNECTA</Link></footer>
      <style>{`
        .ecoPage{min-height:100vh;background:#06100d;color:#f4fff9;font-family:Arial,Helvetica,sans-serif}.ecoHero{padding:28px 5vw 70px;background:radial-gradient(circle at 78% 38%,#0e4937 0,#06100d 38%),linear-gradient(135deg,#071b15,#06100d)}.ecoTop,.ecoFooter{display:flex;align-items:center;justify-content:space-between;gap:20px}.ecoBrand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:800;letter-spacing:.12em}.ecoMark{display:grid;place-items:center;width:38px;height:38px;border:1px solid #59d7a3;border-radius:12px;color:#59d7a3;font-weight:900}.ecoPill,.ecoEyebrow,.ecoTag{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#7fe0b5}.ecoHeroGrid{max-width:1250px;margin:70px auto 0;display:grid;grid-template-columns:1.05fr .95fr;gap:40px;align-items:center}.ecoHero h1{font-size:clamp(48px,7vw,92px);line-height:.95;margin:15px 0 25px;letter-spacing:-.06em}.ecoHero h1 em{font-style:normal;color:#62e3ad}.ecoHero p{max-width:700px;font-size:19px;line-height:1.7;color:#b8cfc5}.ecoActions{display:flex;gap:14px;flex-wrap:wrap;margin-top:30px}.ecoActions a,.ecoOpen{padding:13px 18px;border-radius:999px;text-decoration:none}.ecoPrimary{background:#62e3ad;color:#03110b;font-weight:800}.ecoSecondary{border:1px solid #33584b;color:#eafff4}.ecoOrbit{height:430px;position:relative;display:grid;place-items:center}.ecoCore{width:170px;height:170px;border-radius:50%;display:grid;place-items:center;background:#0b2f24;border:1px solid #4bd49a;box-shadow:0 0 70px #124e3a;font-weight:900;font-size:25px;z-index:2}.ecoCore span{font-size:10px;letter-spacing:.2em}.ecoNode{position:absolute;padding:10px 14px;border:1px solid #2c6854;background:#0a211a;border-radius:999px;font-size:11px;letter-spacing:.12em}.n1{top:4%;left:41%}.n2{top:24%;right:4%}.n3{bottom:23%;right:2%}.n4{bottom:3%;left:40%}.n5{bottom:24%;left:1%}.n6{top:24%;left:2%}.ecoSection{padding:90px 5vw;max-width:1400px;margin:auto}.ecoSectionHead{display:flex;justify-content:space-between;gap:30px;align-items:end;margin-bottom:35px}.ecoSectionHead h2,.ecoBenefits h2,.ecoTrust h2{font-size:clamp(32px,4vw,58px);letter-spacing:-.04em;margin:10px 0}.ecoSectionHead p{max-width:520px;color:#9eb8ad;line-height:1.7}.ecoGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.ecoCard{min-height:245px;padding:25px;border:1px solid #173a2f;background:#091b15;border-radius:22px;color:#fff;text-decoration:none;transition:.2s}.ecoCard:hover{transform:translateY(-4px);border-color:#4bd49a}.ecoIcon{font-size:27px;margin-bottom:25px}.ecoCard h3{font-size:25px;margin:9px 0}.ecoCard p{color:#9eb8ad;line-height:1.55}.ecoOpen{display:inline-block;margin-top:10px;padding:0;color:#65dfad;font-weight:700}.ecoBenefits{padding:90px 8vw;display:grid;grid-template-columns:1.2fr .8fr;gap:60px;background:#0a2019}.ecoBenefits p{max-width:720px;color:#a9c4b8;font-size:18px;line-height:1.8}.ecoPromise{display:grid;grid-template-columns:auto 1fr;gap:8px 20px;align-content:center}.ecoPromise strong{color:#66e0ad;letter-spacing:.12em}.ecoPromise span{color:#a9c4b8}.ecoCategoryGrid{display:flex;flex-wrap:wrap;gap:10px}.ecoCategoryGrid span{padding:12px 15px;border:1px solid #234b3d;border-radius:999px;color:#c5ddd3;background:#091a14}.ecoTrust{padding:90px 8vw;text-align:center;background:#07130f}.ecoTrustGrid{max-width:1100px;margin:40px auto 0;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;text-align:left}.ecoTrustGrid div{padding:22px;border:1px solid #193a30;border-radius:18px;background:#091a14}.ecoTrustGrid b,.ecoTrustGrid span{display:block}.ecoTrustGrid b{margin-bottom:10px}.ecoTrustGrid span{color:#98b5a9;line-height:1.5}.ecoFooter{padding:30px 5vw;border-top:1px solid #15362c;color:#90aa9f}.ecoFooter div{display:flex;align-items:center;gap:10px}.ecoFooter a{color:#64dfad;text-decoration:none}@media(max-width:900px){.ecoHeroGrid,.ecoBenefits{grid-template-columns:1fr}.ecoOrbit{height:320px}.ecoGrid{grid-template-columns:1fr 1fr}.ecoTrustGrid{grid-template-columns:1fr 1fr}.ecoSectionHead{display:block}}@media(max-width:560px){.ecoHero{padding-top:18px}.ecoTop .ecoPill{display:none}.ecoHeroGrid{margin-top:45px}.ecoGrid,.ecoTrustGrid{grid-template-columns:1fr}.ecoOrbit{transform:scale(.85);margin:-15px 0}.ecoFooter{display:block}.ecoFooter>*{margin:12px 0}}
      `}</style>
    </main>
  );
}
