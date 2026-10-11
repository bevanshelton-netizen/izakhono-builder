const sports = ['Football','Rugby','Cricket','Basketball','Athletics','Tennis','Swimming','Boxing','Motorsport','Esports'];
const metrics = [['Athletes','12,480'],['Organisations','386'],['Competitions','74'],['Sponsor opportunities','1,942']];

export default function Home() {
  return <main style={{fontFamily:'Arial,sans-serif',padding:40,maxWidth:1200,margin:'auto'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:48}}>
      <div><strong style={{fontSize:26}}>IZAKHONO SPORTS</strong><div style={{opacity:.65}}>POWERING ALL SPORTS.</div></div>
      <button style={{padding:'12px 18px',borderRadius:8,border:'1px solid #ccc',background:'white'}}>Enter Platform</button>
    </header>
    <section style={{padding:'48px 0'}}><h1 style={{fontSize:58,lineHeight:1.02,maxWidth:800,margin:'0 0 20px'}}>The operating system for the sporting economy.</h1><p style={{fontSize:21,maxWidth:760,opacity:.75}}>Connect athletes, clubs, competitions, sponsors, fans and money through one sport-agnostic infrastructure.</p></section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,margin:'30px 0 50px'}}>{metrics.map(([a,b])=><div key={a} style={{border:'1px solid #ddd',borderRadius:12,padding:20}}><div style={{fontSize:30,fontWeight:700}}>{b}</div><div style={{opacity:.6}}>{a}</div></div>)}</section>
    <section><h2>One engine. Every sport.</h2><div style={{display:'flex',flexWrap:'wrap',gap:10,margin:'20px 0 45px'}}>{sports.map(s=><span key={s} style={{border:'1px solid #ddd',borderRadius:999,padding:'10px 15px'}}>{s}</span>)}</div></section>
    <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
      <article style={{border:'1px solid #ddd',borderRadius:16,padding:28}}><h2>Sports Growth OS</h2><p>Registration, teams, events, results, athlete identity, payments and organisation operations in one connected system.</p></article>
      <article style={{border:'1px solid #ddd',borderRadius:16,padding:28}}><h2>Sponsor Growth OS</h2><p>Discover → Match → Activate → Measure → Optimise → Renew → Expand. Turn sponsorship into measurable growth.</p></article>
    </section>
    <footer style={{marginTop:60,paddingTop:25,borderTop:'1px solid #ddd',opacity:.6}}>Owned-first • Portable • Multi-sport • Global-ready</footer>
  </main>
}
