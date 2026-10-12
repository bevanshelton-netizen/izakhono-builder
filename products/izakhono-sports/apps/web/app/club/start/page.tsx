'use client';

import { FormEvent, useState } from 'react';

export default function StartClubPage() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus('Creating your club request…');
    const form = new FormData(event.currentTarget);
    const payload = { email:String(form.get('email')||''), displayName:String(form.get('name')||''), organisationName:String(form.get('club')||''), organisationType:String(form.get('type')||'club'), countryCode:'ZA', currencyCode:'ZAR' };
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/identity/provision`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create request');
      setStatus('REQUEST RECEIVED • Your club setup is now in the IZAKHONO onboarding queue.');
      (event.target as HTMLFormElement).reset();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to create request. Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="shell">
    <header className="nav"><div className="navInner"><a className="brand" href="/">IZAKHONO SPORTS<small>POWERING ALL SPORTS.</small></a><a className="navCta" href="/club">BACK TO CLUB</a></div></header>
    <section className="section" style={{paddingTop:150,minHeight:'100vh'}}><div className="sectionHead"><div className="kicker">Free Club Onboarding</div><h1 style={{fontFamily:'var(--font-display)',fontSize:'clamp(64px,10vw,120px)',lineHeight:.84,margin:'12px 0 24px'}}>BUILD MY <span style={{color:'var(--gold)'}}>CLUB.</span></h1><p className="sectionLead">Create the foundation. Bring your organisation into the connected sporting economy.</p></div>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.2fr) minmax(280px,.8fr)',gap:35,alignItems:'start'}}>
        <form onSubmit={submit} style={{display:'grid',gap:15}}>
          <label>YOUR NAME<input required name="name" className="formInput" placeholder="Club owner / administrator" /></label>
          <label>EMAIL<input required type="email" name="email" className="formInput" placeholder="you@club.co.za" /></label>
          <label>CLUB / ORGANISATION NAME<input required name="club" className="formInput" placeholder="Example Sports Club" /></label>
          <label>ORGANISATION TYPE<select name="type" className="formInput"><option value="club">Sports club</option><option value="academy">Academy</option><option value="school">School</option><option value="league">League</option><option value="federation">Federation</option><option value="venue">Venue</option><option value="other">Other</option></select></label>
          <button disabled={busy} type="submit" className="button primary" style={{border:0,cursor:busy?'wait':'pointer',marginTop:8}}>{busy?'CREATING…':'CREATE MY CLUB →'}</button>
        </form>
        <aside style={{border:'1px solid var(--line)',background:'linear-gradient(145deg,#15130f,#0d0d0d)',padding:28}}><div className="kicker">Your next move</div><h2 style={{fontFamily:'var(--font-display)',fontSize:50,lineHeight:.9}}>START FREE.</h2><p style={{color:'#aaa',lineHeight:1.65,fontSize:14}}>No fake numbers. No complicated setup. We capture the organisation request first, then the platform can provision the club environment as the infrastructure is connected.</p><div style={{borderTop:'1px solid var(--line)',marginTop:25,paddingTop:18,color:'#ccc',fontSize:12,lineHeight:1.8}}>01 / Club identity<br/>02 / People & teams<br/>03 / Operations<br/>04 / Revenue & opportunity</div></aside>
      </div>
      {status && <div style={{marginTop:25,padding:18,border:'1px solid rgba(214,168,79,.45)',background:'rgba(214,168,79,.08)',color:'#eee'}}>{status}</div>}
    </section>
    <footer className="footer"><div className="footerInner"><span>IZAKHONO SPORTS • CLUB ONBOARDING</span><span>POWERING ALL SPORTS.</span></div></footer>
  </main>
}
