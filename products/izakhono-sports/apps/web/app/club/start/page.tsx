'use client';

import { FormEvent, useState } from 'react';

export default function StartClubPage() {
  const [status, setStatus] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Creating your club request…');
    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get('email') || ''),
      displayName: String(form.get('name') || ''),
      organisationName: String(form.get('club') || ''),
      organisationType: String(form.get('type') || 'club'),
      countryCode: 'ZA',
      currencyCode: 'ZAR'
    };
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/identity/provision`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create request');
      setStatus('You are in. Your IZAKHONO SPORTS club setup request has been received.');
      (event.target as HTMLFormElement).reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to create request. Please try again.');
    }
  }
  return <main style={{fontFamily:'Arial,sans-serif',maxWidth:720,margin:'auto',padding:'45px 6%'}}>
    <a href="/club" style={{color:'#111'}}>← Back to Club</a>
    <h1 style={{fontSize:48,lineHeight:1,marginTop:45}}>Build my club.</h1>
    <p style={{fontSize:19,color:'#666',lineHeight:1.5}}>Start free. Tell us who you are and we will create your club onboarding request.</p>
    <form onSubmit={submit} style={{display:'grid',gap:16,marginTop:35}}>
      <label>Your name<input required name="name" style={input} placeholder="Club owner / administrator" /></label>
      <label>Email<input required type="email" name="email" style={input} placeholder="you@club.co.za" /></label>
      <label>Club / organisation name<input required name="club" style={input} placeholder="Example Sports Club" /></label>
      <label>Organisation type<select name="type" style={input}><option value="club">Sports club</option><option value="academy">Academy</option><option value="school">School</option><option value="league">League</option><option value="federation">Federation</option><option value="venue">Venue</option><option value="other">Other</option></select></label>
      <button type="submit" style={{border:0,borderRadius:8,padding:16,background:'#ff7a00',color:'#fff',fontWeight:800,fontSize:16}}>CREATE MY CLUB →</button>
    </form>
    {status && <p style={{marginTop:25,padding:18,borderRadius:10,background:'#f5f5f5',lineHeight:1.5}}>{status}</p>}
    <p style={{marginTop:40,color:'#888',fontSize:13}}>IZAKHONO SPORTS • POWERING ALL SPORTS.</p>
  </main>
}

const input = { display:'block', width:'100%', boxSizing:'border-box' as const, marginTop:7, padding:'13px 14px', border:'1px solid #ccc', borderRadius:8, fontSize:16 };
