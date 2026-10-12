const sports = ['Football','Rugby','Cricket','Basketball','Athletics','Tennis','Swimming','Boxing','Motorsport','Esports'];
const features = [
  ['Member & Athlete Management','Profiles, registrations, teams and digital Sports IDs.'],
  ['Attendance & Events','Track attendance, fixtures, training and competitions.'],
  ['Billing & Memberships','Turn memberships and subscriptions into recurring revenue.'],
  ['Sponsors & Commercials','Create sponsor inventory and connect it to buyers.'],
  ['Results & Performance','Record results, achievements and athlete progress.'],
  ['Discovery & Scouting','Make eligible athletes discoverable to scouts and sponsors.']
];
const plans = [
  ['STARTER','R299 / month','For emerging clubs','Members, teams, attendance, events, registrations'],
  ['CLUB','R599 / month','For growing organisations','Everything in Starter + billing, reports, communications, athlete profiles'],
  ['PRO SPORTS','R999 / month','For ambitious clubs & academies','Everything in Club + sponsorship, scouting, Sports ID and commercial analytics']
];

export default function Home() {
  return <main style={{fontFamily:'Arial,sans-serif',color:'#111',background:'#fff'}}>
    <header style={{padding:'24px 6%',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #eee',position:'sticky',top:0,background:'#fff',zIndex:5}}>
      <div><strong style={{fontSize:25}}>IZAKHONO SPORTS</strong><div style={{opacity:.6,fontSize:13,letterSpacing:1}}>POWERING ALL SPORTS.</div></div>
      <nav style={{display:'flex',gap:18,alignItems:'center'}}><a href="#pricing" style={{color:'#111'}}>Pricing</a><a href="/club" style={{background:'#111',color:'#fff',padding:'11px 17px',borderRadius:8,textDecoration:'none'}}>For Clubs</a></nav>
    </header>
    <section style={{padding:'90px 6% 70px',background:'linear-gradient(135deg,#f7f7f7,#fff)'}}>
      <div style={{maxWidth:1050}}><div style={{fontWeight:700,letterSpacing:2,marginBottom:18}}>SPORTS ECONOMY INFRASTRUCTURE</div><h1 style={{fontSize:'clamp(44px,7vw,78px)',lineHeight:.98,maxWidth:900,margin:'0 0 25px'}}>Your club deserves more than a WhatsApp group.</h1><p style={{fontSize:23,lineHeight:1.45,maxWidth:760,color:'#555'}}>Run your club, grow your athletes, collect revenue and unlock sponsorship from one connected sports platform.</p><div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:30}}><a href="/club/start" style={{background:'#ff7a00',color:'#fff',padding:'15px 23px',borderRadius:8,fontWeight:700,textDecoration:'none'}}>BUILD MY CLUB FREE →</a><a href="#pricing" style={{padding:'15px 23px',border:'1px solid #bbb',borderRadius:8,fontWeight:700,textDecoration:'none',color:'#111'}}>SEE PLANS</a></div></div>
    </section>
    <section style={{padding:'60px 6%'}}><h2 style={{fontSize:38}}>Everything your club needs.</h2><p style={{color:'#666',fontSize:18}}>Start with administration. Grow into the sporting economy.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:16,marginTop:30}}>{features.map(([title,copy])=><article key={title} style={{border:'1px solid #e5e5e5',borderRadius:14,padding:25}}><h3>{title}</h3><p style={{color:'#666',lineHeight:1.5}}>{copy}</p></article>)}</div></section>
    <section style={{padding:'55px 6%',background:'#111',color:'#fff'}}><h2 style={{fontSize:40,maxWidth:800}}>One club can become an athlete network. One network can become a sports economy.</h2><p style={{fontSize:19,color:'#ccc',maxWidth:800,lineHeight:1.6}}>Every club on IZAKHONO can connect athletes, competitions, sponsors, scouts, media and commercial opportunities. We start by solving the club's daily problems — then unlock the value around them.</p></section>
    <section style={{padding:'60px 6%'}}><h2 style={{fontSize:38}}>One engine. Every sport.</h2><div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:20}}>{sports.map(s=><span key={s} style={{border:'1px solid #ddd',borderRadius:999,padding:'10px 15px'}}>{s}</span>)}</div></section>
    <section id="pricing" style={{padding:'60px 6%',background:'#f7f7f7'}}><h2 style={{fontSize:38}}>Simple pricing. Serious capability.</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:18,marginTop:30}}>{plans.map(([name,price,who,copy],i)=><article key={name} style={{background:'#fff',border:'1px solid #ddd',borderRadius:16,padding:28}}><div style={{fontWeight:800,letterSpacing:1}}>{name}</div><div style={{fontSize:32,fontWeight:800,margin:'15px 0'}}>{price}</div><div style={{fontWeight:700}}>{who}</div><p style={{color:'#666',lineHeight:1.5}}>{copy}</p><a href="/club/start" style={{display:'block',textAlign:'center',marginTop:24,padding:13,borderRadius:8,background:i===2?'#111':'#ff7a00',color:'#fff',textDecoration:'none',fontWeight:700}}>START NOW</a></article>)}</div></section>
    <footer style={{padding:'35px 6%',borderTop:'1px solid #ddd',color:'#777'}}>IZAKHONO SPORTS • POWERING ALL SPORTS. • Owned-first • Multi-sport • Global-ready</footer>
  </main>
}
