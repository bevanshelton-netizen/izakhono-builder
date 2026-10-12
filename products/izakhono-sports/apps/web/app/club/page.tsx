const modules = [
  ['01','RUN YOUR CLUB','Members, teams, coaches, attendance, events and communications.'],
  ['02','COLLECT REVENUE','Memberships, subscriptions, billing and payment-ready workflows.'],
  ['03','BUILD ATHLETES','Professional athlete profiles, results, achievements and Sports IDs.'],
  ['04','FIND OPPORTUNITIES','Sponsor inventory, scouting visibility and commercial discovery.']
];

export default function ClubPage() {
  return <main style={{fontFamily:'Arial,sans-serif',color:'#111',maxWidth:1180,margin:'auto',padding:'30px 6% 70px'}}>
    <a href="/" style={{color:'#111',textDecoration:'none'}}>← IZAKHONO SPORTS</a>
    <section style={{padding:'70px 0 45px'}}><div style={{fontWeight:800,letterSpacing:2,color:'#ff7a00'}}>IZAKHONO SPORTS CLUB</div><h1 style={{fontSize:'clamp(42px,7vw,72px)',lineHeight:1,margin:'18px 0'}}>Run your club smarter.</h1><p style={{fontSize:22,lineHeight:1.5,color:'#555',maxWidth:780}}>A connected operating system for sports clubs, academies, schools, dojos and federations — without the administrative headache.</p><a href="/club/start" style={{display:'inline-block',marginTop:25,background:'#ff7a00',color:'#fff',padding:'16px 25px',borderRadius:8,fontWeight:800,textDecoration:'none'}}>BUILD MY CLUB FREE →</a></section>
    <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16}}>{modules.map(([n,t,c])=><article key={n} style={{border:'1px solid #ddd',borderRadius:16,padding:25}}><div style={{fontWeight:800,color:'#ff7a00'}}>{n}</div><h2>{t}</h2><p style={{color:'#666',lineHeight:1.5}}>{c}</p></article>)}</section>
    <section style={{marginTop:60,padding:35,borderRadius:18,background:'#111',color:'#fff'}}><h2 style={{fontSize:34}}>Free to get started.</h2><p style={{color:'#ccc',fontSize:18,lineHeight:1.6}}>Create your club profile first. Upgrade when you need more. Your club should own its digital presence, its athlete relationships and its commercial opportunities.</p></section>
  </main>
}
