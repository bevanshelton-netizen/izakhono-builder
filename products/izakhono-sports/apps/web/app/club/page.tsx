const modules = [
  ['01','RUN YOUR CLUB','Members, teams, coaches, attendance, events and communications.'],
  ['02','COLLECT REVENUE','Memberships, subscriptions, billing and payment-ready workflows.'],
  ['03','BUILD ATHLETES','Professional athlete profiles, results, achievements and Sports IDs.'],
  ['04','FIND OPPORTUNITIES','Sponsor inventory, scouting visibility and commercial discovery.']
];
const workflow = ['CREATE YOUR CLUB','ADD YOUR PEOPLE','RUN YOUR SEASON','UNLOCK REVENUE'];

export default function ClubPage() {
  return <main className="shell">
    <header className="nav"><div className="navInner"><a className="brand" href="/">IZAKHONO SPORTS<small>POWERING ALL SPORTS.</small></a><nav className="navLinks"><a href="/#sports">Sports</a><a href="/#pricing">Pricing</a><a className="navCta" href="/club/start">BUILD MY CLUB FREE</a></nav></div></header>
    <section className="hero" style={{minHeight:720}}><div className="heroArt"/><div className="heroGrid"><div className="eyebrow">IZAKHONO SPORTS CLUB</div><h1>Run your club <span>smarter.</span></h1><p>One premium operating layer for clubs, academies, schools, dojos and sporting organisations. Replace scattered admin with one connected club command centre.</p><div className="actions"><a className="button primary" href="/club/start">BUILD MY CLUB FREE →</a><a className="button secondary" href="#modules">SEE WHAT'S INSIDE</a></div></div></section>
    <section id="modules" className="section"><div className="sectionHead"><div className="kicker">The Club Command Centre</div><h2>Everything your organisation needs to move.</h2><p className="sectionLead">The daily operating layer comes first. The wider sports economy comes next.</p></div><div className="featureGrid">{modules.map(([n,t,c])=><article className="feature" key={n}><div className="featureNo">{n}</div><h3>{t}</h3><p>{c}</p></article>)}</div></section>
    <section className="section dark"><div className="sectionHead"><div className="kicker">From setup to scale</div><h2>Four moves. One connected club.</h2></div><div className="sportStrip">{workflow.map((item,i)=><div className="sport" key={item}><span>0{i+1} / {item}</span></div>)}</div></section>
    <section className="section"><div className="economy"><div><div className="kicker">Built for ownership</div><h2>Your club. Your people. Your data.</h2><p className="sectionLead">IZAKHONO is designed to become the digital foundation of the organisation — not another disconnected tool you have to work around.</p><div className="actions"><a className="button primary" href="/club/start">CREATE MY CLUB →</a></div></div><div className="orbit"><div className="core">YOUR<br/>CLUB</div><div className="node n1">Members</div><div className="node n2">Teams</div><div className="node n3">Athletes</div><div className="node n4">Revenue</div><div className="node n5">Sponsors</div></div></div></section>
    <footer className="footer"><div className="footerInner"><span>IZAKHONO SPORTS • CLUB</span><span>POWERING ALL SPORTS.</span></div></footer>
  </main>
}
