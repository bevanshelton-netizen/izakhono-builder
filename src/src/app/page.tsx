'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type Post = { id:string; title:string; master_copy:string; status:string; approval_status:string; content_type:string; created_at:string }
type Campaign = { id:string; name:string; objective:string; status:string; offer:string|null; landing_url:string|null; created_at:string }

function supabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  return url && key ? createClient(url, key) : null
}

const modules = [
  ['01','Content Studio','Create, rewrite and repurpose high-converting content.'],
  ['02','Campaign Planner','Turn offers and launches into execution plans.'],
  ['03','Publishing Queue','Prepare approved content for connected channels.'],
  ['04','Channel Router','Route content through the best available channel.'],
  ['05','Analytics','Measure reach, engagement, leads and revenue.'],
  ['06','Revenue Command','Connect campaigns to commercial outcomes.'],
]

export default function Home(){
  const [client] = useState(supabase)
  const [user,setUser] = useState<User|null>(null)
  const [posts,setPosts] = useState<Post[]>([])
  const [campaigns,setCampaigns] = useState<Campaign[]>([])
  const [copy,setCopy] = useState('')
  const [title,setTitle] = useState('')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')

  useEffect(()=>{
    if(!client) return
    client.auth.getUser().then(({data})=>setUser(data.user ?? null))
    const {data:{subscription}} = client.auth.onAuthStateChange((_event,session)=>setUser(session?.user ?? null))
    return ()=>subscription.unsubscribe()
  },[client])

  useEffect(()=>{
    if(!client || !user) return
    let mounted=true
    Promise.all([
      client.from('social_posts').select('id,title,master_copy,status,approval_status,content_type,created_at').order('created_at',{ascending:false}).limit(8),
      client.from('social_campaigns').select('id,name,objective,status,offer,landing_url,created_at').order('created_at',{ascending:false}).limit(6)
    ]).then(([p,c])=>{
      if(!mounted) return
      if(p.data) setPosts(p.data as Post[])
      if(c.data) setCampaigns(c.data as Campaign[])
      if(p.error || c.error) setMessage('Workspace access is configured, but your account may need workspace membership.')
    })
    return ()=>{mounted=false}
  },[client,user])

  const stats = useMemo(()=>[
    [String(posts.length),'Recent content'],
    [String(campaigns.length),'Active campaigns'],
    [user ? 'CONNECTED':'LOCKED','Supabase control plane'],
    ['6','Core modules'],
  ],[posts.length,campaigns.length,user])

  async function signIn(){
    if(!client || !email || !password) return setMessage('Enter your email and password.')
    setBusy(true); setMessage('Signing in…')
    const {error}=await client.auth.signInWithPassword({email,password})
    setBusy(false); setMessage(error ? error.message : 'Command Centre connected.')
  }

  async function saveDraft(){
    if(!client || !user) return setMessage('Sign in to create a content record.')
    if(!title.trim() || !copy.trim()) return setMessage('Add a title and master copy first.')
    setBusy(true)
    const {error}=await client.from('social_posts').insert({
      owner_id:user.id, workspace_id:user.user_metadata?.workspace_id, title:title.trim(), master_copy:copy.trim(),
      content_type:'social', approval_status:'draft', status:'draft', score:{}
    })
    setBusy(false)
    if(error) setMessage(error.message)
    else { setMessage('Draft saved to the Social Command control plane.'); setTitle(''); setCopy('') }
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="mark">I</span><div><strong>IZAKHONO</strong><small>SOCIAL COMMAND™</small></div></div><div className="status">● {user?'CONTROL PLANE CONNECTED':'SYSTEM READY'}</div></header>
    <div className="layout">
      <aside className="sidebar"><div className="navlabel">COMMAND</div>{['Overview','Content Studio','Campaigns','Publishing Queue','Analytics','Revenue'].map((x,i)=><button key={x} className={'navitem '+(i===0?'active':'')}><span>{['⌂','✦','◈','↗','◒','R'][i]}</span><span>{x}</span></button>)}<div className="navlabel" style={{marginTop:24}}>SYSTEM</div><button className="navitem"><span>⚙</span><span>Channels & Integrations</span></button><button className="navitem"><span>✓</span><span>Approvals</span></button></aside>
      <section className="main">
        <div className="eyebrow">OWNED-FIRST MARKETING OPERATING SYSTEM</div><h1 className="headline">Turn attention into<br/><span style={{color:'#54df87'}}>business growth.</span></h1><p className="sub">One command centre for content, campaigns, publishing, channels, analytics and revenue — built for the IZAKHONO ecosystem.</p>
        <div className="grid">{stats.map(([a,b])=><div className="card" key={b}><div className="metric">{a}</div><div className="muted">{b}</div><div className="delta">LIVE CONTROL LAYER</div></div>)}</div>
        {!user && <div className="panel" style={{marginTop:16}}><div className="panelhead"><h2>Connect your command centre</h2><span className="pill">AUTHENTICATION</span></div><div className="composer"><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input className="input" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="actions"><span className="muted">Your account controls workspace data through Supabase RLS.</span><button className="btn primary" onClick={signIn} disabled={busy}>Connect →</button></div></div></div>}
        <div className="workspace">
          <div className="panel"><div className="panelhead"><h2>Content Studio → Publishing Queue</h2><span className="pill">{posts.length} RECORDS</span></div><div className="composer"><input className="input" placeholder="Content title" value={title} onChange={e=>setTitle(e.target.value)}/><textarea placeholder="Write the master copy once. Social Command will become the distribution layer for approved channels." value={copy} onChange={e=>setCopy(e.target.value)}/><div className="actions"><span className="muted">Drafts stay in the owned control plane.</span><button className="btn primary" onClick={saveDraft} disabled={busy || !user}>Save Draft →</button></div>{message && <div className="muted" style={{marginTop:10}}>{message}</div>}</div><div className="rows">{posts.map(p=><div className="row" key={p.id}><div><strong>{p.title}</strong><small>{p.content_type} · {new Date(p.created_at).toLocaleDateString()}</small></div><span className="badge">{p.approval_status}</span><span className="channel">{p.status}</span></div>)}{!posts.length && <div className="muted" style={{padding:18}}>No content records visible yet. Sign in and create the first draft.</div>}</div></div>
          <div className="panel"><div className="panelhead"><h2>Campaign Command</h2><span className="pill">CONTROL</span></div><div className="rows">{campaigns.map(c=><div className="row" style={{gridTemplateColumns:'1fr 90px'}} key={c.id}><div><strong>{c.name}</strong><small>{c.objective}{c.offer?' · '+c.offer:''}</small></div><span className="badge gray">{c.status}</span></div>)}{!campaigns.length && <div className="muted" style={{padding:18}}>Campaigns will appear here when workspace data is connected.</div>}</div></div>
        </div>
        <div className="modulegrid">{modules.map(([n,t,d])=><div className="module" key={t}><div><span className="eyebrow">{n}</span> <b>{t}</b></div><p>{d}</p></div>)}</div>
        <div className="footer">IZAKHONO SOCIAL COMMAND™ · OWNED-FIRST · AFRICAN-FIRST · GLOBAL-READY · OFFER → CAMPAIGN → CONTENT → LEAD → REVENUE</div>
      </section>
    </div>
  </main>
}
