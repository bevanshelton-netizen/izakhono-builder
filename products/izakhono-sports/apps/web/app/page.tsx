const sports = ['Football','Rugby','Cricket','Basketball','Athletics','Tennis','Swimming','Boxing','Motorsport','Esports'];
const features = [
  ['01','Club Command Centre','Memberships, athlete records, teams, registrations and digital Sports IDs in one operating layer.'],
  ['02','Attendance & Events','Training, fixtures, competitions and attendance without spreadsheet chaos.'],
  ['03','Revenue Engine','Memberships, subscriptions and billing designed to turn administration into recurring revenue.'],
  ['04','Sponsor Marketplace','Package your inventory, match opportunities and build commercial relationships.'],
  ['05','Performance Intelligence','Results, achievements, progress and competition data that follows the athlete.'],
  ['06','Discovery Network','Make eligible athletes visible to scouts, sponsors and sporting opportunities.']
];
const plans = [
  {name:'STARTER',price:'R299',who:'Emerging clubs',items:['Members & teams','Attendance','Events & registrations','Club profile']},
  {name:'CLUB',price:'R599',who:'Growing organisations',items:['Everything in Starter','Billing & memberships','Reports & communications','Athlete profiles'],featured:true},
  {name:'PRO SPORTS',price:'R999',who:'Ambitious clubs & academies',items:['Everything in Club','Sponsorship tools','Scouting & Sports ID','Commercial analytics']}
];

export default function Home() {
  return <main className="shell">
    <header className="nav"><div className="navInner">
      <a className="brand" href="#top">IZAKHONO SPORTS<small>POWERING ALL SPORTS.</small></a>
      <nav className="navLinks"><a href="#platform">Platform</a><a href="#sports">Sports</a><a href="#pricing">Pricing</a><a className="navCta" href="/club/start">BUILD MY CLUB FREE</a></nav>
    </div></header>
    <section id="top" className="hero"><div className="heroArt"/><div className="heroGrid">
      <div className="eyebrow">Sports Economy Infrastructure</div>
      <h1>Your club deserves <span>more.</span></h1>
      <p>Run the club. Develop the athlete. Grow revenue. Unlock sponsorship. IZAKHONO SPORTS connects the people, performance and opportunity behind every sport.</p>
      <div className="actions"><a className="button primary" href="/club/start">BUILD MY CLUB FREE →</a><a className="button secondary" href="#platform">EXPLORE THE ENGINE</a></div>
    </div></section>
    <div className="ticker"><div className="tickerInner"><strong>POWERING ALL SPORTS</strong><span>CLUBS</span><span>ATHLETES</span><span>COMPETITIONS</span><span>SPONSORS</span><span>SCOUTS</span><span>MEDIA</span><span>FEDERATIONS</span></div></div>
    <section id="platform" className="section"><div className="sectionHead"><div className="kicker">The Club Operating Layer</div><h2>Everything. Connected.</h2><p className="sectionLead">Start with the work clubs do every day. Then connect that operational foundation to the larger sporting economy.</p></div>
      <div className="featureGrid">{features.map(([no,title,copy])=><article className="feature" key={title}><div className="featureNo">{no}</div><h3>{title}</h3><p>{copy}</p></article>)}</div>
    </section>
    <section className="section dark"><div className="section economy"><div><div className="kicker">Beyond Club Management</div><h2>One club. A whole economy.</h2><p className="sectionLead">A club creates athletes. Athletes create competitions. Competitions create audiences. Audiences create commercial value. IZAKHONO connects the chain.</p><div className="actions"><a className="button primary" href="/club/start">START BUILDING →</a></div></div><div className="orbit"><div className="core">SPORTS<br/>ECONOMY</div><div className="node n1">Athletes</div><div className="node n2">Sponsors</div><div className="node n3">Competitions</div><div className="node n4">Media</div><div className="node n5">Scouts</div></div></div></section>
    <section id="sports" className="section"><div className="sectionHead"><div className="kicker">Sport-Agnostic by Design</div><h2>One engine. Every sport.</h2><p className="sectionLead">Football is one sport. IZAKHONO SPORTS is infrastructure for all of them.</p></div><div className="sportStrip">{sports.map(s=><div className="sport" key={s}><span>{s}</span></div>)}</div></section>
    <section id="pricing" className="section dark"><div className="sectionHead"><div className="kicker">Launch Your Club</div><h2>Serious capability. Simple pricing.</h2><p className="sectionLead">Start free. Upgrade when your organisation grows.</p></div><div className="pricing">{plans.map(plan=><article className={`priceCard${plan.featured?' featured':''}`} key={plan.name}>{plan.featured&&<div className="badge">MOST POPULAR</div>}<div className="plan">{plan.name}</div><div className="price">{plan.price}<small> / month</small></div><strong>{plan.who}</strong><ul className="priceList">{plan.items.map(item=><li key={item}>✓ {item}</li>)}</ul><a className={`button ${plan.featured?'primary':'secondary'}`} href="/club/start">START NOW →</a></article>)}</div></section>
    <section className="finalCta"><div className="kicker">The Future of Sport Is Connected</div><h2>Stop running your club from scattered tools.</h2><p className="sectionLead" style={{margin:'0 auto'}}>Build the foundation that lets athletes, clubs and opportunities move together.</p><div className="actions" style={{justifyContent:'center'}}><a className="button primary" href="/club/start">BUILD MY CLUB FREE →</a></div></section>
    <footer className="footer"><div className="footerInner"><span>IZAKHONO SPORTS • POWERING ALL SPORTS.</span><span>Sports Economy Infrastructure • Global-ready</span></div></footer>
  </main>
}
