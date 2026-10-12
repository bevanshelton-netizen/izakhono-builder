const sections = [
  ['CLUB HQ','Organisation profile, seasons, teams and administrators.'],
  ['PEOPLE','Members, coaches, officials and athlete records.'],
  ['OPERATIONS','Attendance, fixtures, events, competitions and results.'],
  ['MONEY','Memberships, billing, payment activity and financial workflows.'],
  ['ATHLETE ECONOMY','Sports IDs, profiles, achievements and discovery.'],
  ['COMMERCIAL','Sponsor inventory, opportunities, activations and measurement.']
];

export default function ClubDashboardPage() {
  return <main className="shell">
    <header className="nav"><div className="navInner"><a className="brand" href="/">IZAKHONO SPORTS<small>POWERING ALL SPORTS.</small></a><nav className="navLinks"><a href="/club">Club</a><a href="/club/start" className="navCta">CREATE CLUB</a></nav></div></header>
    <section className="section" style={{paddingTop:145}}><div className="eyebrow">IZAKHONO SPORTS / CLUB COMMAND CENTRE</div><h1>Welcome to <span style={{color:'var(--gold)'}}>Club HQ.</span></h1><p className="sectionLead">This is the operating shell for your organisation. Live organisation data will appear here once the club is provisioned and an authorised user signs in.</p>
      <div className="featureGrid" style={{marginTop:45}}>{sections.map(([title,copy],i)=><article className="feature" key={title}><div className="featureNo">0{i+1}</div><h3>{title}</h3><p>{copy}</p><div style={{marginTop:25,color:'#666',fontSize:10,letterSpacing:2,textTransform:'uppercase'}}>Awaiting club connection</div></article>)}</div>
    </section>
    <section className="section dark"><div className="economy"><div><div className="kicker">Next step</div><h2>Connect the organisation.</h2><p className="sectionLead">Provisioning creates the foundation. Authentication and organisation membership unlock the real command centre.</p><div className="actions"><a className="button primary" href="/club/start">START CLUB ONBOARDING →</a></div></div><div className="orbit"><div className="core">CLUB<br/>HQ</div><div className="node n1">People</div><div className="node n2">Operations</div><div className="node n3">Athletes</div><div className="node n4">Money</div><div className="node n5">Commercial</div></div></div></section>
    <footer className="footer"><div className="footerInner"><span>IZAKHONO SPORTS • CLUB HQ</span><span>NO DEMO DATA • REAL DATA ONLY</span></div></footer>
  </main>
}
