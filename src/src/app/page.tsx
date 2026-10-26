'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type Workspace = { id:string; name:string; timezone:string }
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
  const [workspace,setWorkspace] = useState<Workspace|null>(null)
  const [posts,setPosts] = useState<Post[]>([])
  const [campaigns,setCampaigns] = useState<Campaign[]>([])
  const [copy,setCopy] = useState('')
  const [title,setTitle] = useState('')
  const [campaignName,setCampaignName] = useState('')
  const [campaignObjective,setCampaignObjective] = useState('awareness')
  const [campaignOffer,setCampaignOffer] = useState('')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [busy,setBusy] = useState(false)
  const [booting,setBooting] = useState(true)
  const [message,setMessage] = useState('')

  async function loadWorkspace(currentUser:User){
    if(!client) return null
    const existing = await client.from('social_workspaces').select('id,name,timezone').eq('owner_id',currentUser.id).order('created_at',{ascending:true}).limit(1).maybeSingle()
    if(existing.error) throw existing.error
    if(existing.data) return existing.data as Workspace
    const created = await client.from('social_workspaces').insert({owner_id:currentUser.id,name:'IZAKHONO Social Command',timezone:'Africa/Johannesburg'}).select('id,name,timezone').single()
    if(created.error) throw created.error
    return created.data as Workspace
  }

  async function refreshWorkspace(currentUser:User){
    if(!client) return
    try {
      const ws = await loadWorkspace(currentUser)
      if(!ws) return
      setWorkspace(ws)
      const [p,c] = await Promise.all([
        client.from('social_posts').select('id,title,master_copy,status,approval_status,content_type,created_at').eq('owner_id',currentUser.id).eq('workspace_id',ws.id).order('created_at',{ascending:false}).limit(8),
        client.from('social_campaigns').select('id,name,objective,status,offer,landing_url,created_at').eq('owner_id',currentUser.id).eq('workspace_id',ws.id).order('created_at',{ascending:false}).limit(6)
      ])
      if(p.error) throw p.error
      if(c.error) throw c.error
      setPosts((p.data ?? []) as Post[])
      setCampaigns((c.data ?? []) as Campaign[])
    } catch(error) {
      setMessage(error instanceof Error ? error.message : 'Workspace connection failed.')
    }
  }

  useEffect(()=>{
    if(!client){ setBooting(false); return }
    let mounted = true
    client.auth.getUser().then(async ({data,error})=>{
      if(error){ if(mounted) setMessage(error.message); return }
      if(data.user){
        setUser(data.user)
        await refreshWorkspace(data.user)
      }
      if(mounted) setBooting(false)
    })
    const {data:{subscription}} = client.auth.onAuthStateChange((_event,session)=>{
      const next = session?.user ?? null
      setUser(next)
      if(next) void refreshWorkspace(next)
      else { setWorkspace(null); setPosts([]); setCampaigns([]) }
    })
    return ()=>{ mounted=false; subscription.unsubscribe() }
  },[client])

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
    setBusy(false)
    if(error) setMessage(error.message)
    else setMessage('Command Centre connected. Bootstrapping workspace…')
  }

  async function signOut(){
    if(!client) return
    setBusy(true)
    const {error}=await client.auth.signOut()
    setBusy(false)
    if(error) setMessage(error.message)
    else setMessage('Signed out securely.')
  }

  async function saveDraft(){
    if(!client || !user || !workspace) return setMessage('Connect your workspace first.')
    if(!title.trim() || !copy.trim()) return setMessage('Add a title and master copy first.')
    setBusy(true)
    const {data,error}=await client.from('social_posts').insert({
      owner_id:user.id, workspace_id:workspace.id, title:title.trim(), master_copy:copy.trim(),
      content_type:'social', approval_status:'draft', status:'draft', score:{}
    }).select('id,title,master_copy,status,approval_status,content_type,created_at').single()
    setBusy(false)
    if(error) setMessage(error.message)
    else { setPosts(current=>[data as Post,...current].slice(0,8)); setMessage('Draft saved to the Social Command control plane.'); setTitle(''); setCopy('') }
  }

  async function createCampaign(){
    if(!client || !user || !workspace) return setMessage('Connect your workspace first.')
    if(!campaignName.trim()) return setMessage('Add a campaign name first.')
    setBusy(true)
    const {data,error}=await client.from('social_campaigns').insert({
      owner_id:user.id, workspace_id:workspace.id, name:campaignName.trim(), objective:campaignObjective,
      offer:campaignOffer.trim() || null, status:'draft', budget_cents:0
    }).select('id,name,objective,status,offer,landing_url,created_at').single()
    setBusy(false)
    if(error) setMessage(error.message)
    else { setCampaigns(current=>[data as Campaign,...current].slice(0,6)); setMessage('Campaign created in the owned control plane.'); setCampaignName(''); setCampaignOffer('') }
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="mark">I</span><div><strong>IZAKHONO</strong><small>SOCIAL COMMAND™</small></div></div><div className="status">● {user?'CONTROL PLANE CONNECTED':'SYSTEM READY'}</div></header>
    <div className="layout">
      <aside className="sidebar"><div className="navlabel">COMMAND</div>{['Overview','Content Studio','Campaigns','Publishing Queue','Analytics','Revenue'].map((x,i)=><button key={x} className={'navitem '+(i===0?'active':'')}><span>{['⌂','✦','◈','↗','◒','R'][i]}</span><span>{x}</span></button>)}<div className="navlabel" style={{marginTop:24}}>SYSTEM</div><button className="navitem"><span>⚙</span><span>Channels & Integrations</span></button><button className="navitem"><span>✓</span><span>Approvals</span></button>{user && <button className="navitem" onClick={signOut} disabled={busy}><span>↪</span><span>Sign out</span></button>}</aside>
      <section className="main">
        <div className="eyebrow">OWNED-FIRST MARKETING OPERATING SYSTEM</div><h1 className="headline">Turn attention into<br/><span style={{color:'#54df87'}}>business growth.</span></h1><p className="sub">One command centre for content, campaigns, publishing, channels, analytics and revenue — built for the IZAKHONO ecosystem.</p>
        <div className="grid">{stats.map(([a,b])=><div className="card" key={b}><div className="metric">{a}</div><div className="muted">{b}</div><div className="delta">LIVE CONTROL LAYER</div></div>)}</div>
        {booting && <div className="panel" style={{marginTop:16}}><div className="muted">Connecting to the IZAKHONO control plane…</div></div>}
        {!booting && !user && <div className="panel" style={{marginTop:16}}><div className="panelhead"><h2>Connect your command centre</h2><span className="pill">AUTHENTICATION</span></div><div className="composer"><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input className="input" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="actions"><span className="muted">Your account controls workspace data through Supabase RLS.</span><button className="btn primary" onClick={signIn} disabled={busy}>Connect →</button></div></div></div>}
        {user && workspace && <div className="workspacebar"><span className="pill">WORKSPACE</span><strong>{workspace.name}</strong><span className="muted">{workspace.timezone}</span></div>}
        <div className="workspace">
          <div className="panel"><div className="panelhead"><h2>Content Studio → Publishing Queue</h2><span className="pill">{posts.length} RECORDS</span></div><div className="composer"><input className="input" placeholder="Content title" value={title} onChange={e=>setTitle(e.target.value)}/><textarea placeholder="Write the master copy once. Social Command will become the distribution layer for approved channels." value={copy} onChange={e=>setCopy(e.target.value)}/><div className="actions"><span className="muted">Drafts stay in the owned control plane.</span><button className="btn primary" onClick={saveDraft} disabled={busy || !user || !workspace}>Save Draft →</button></div>{message && <div className="muted" style={{marginTop:10}}>{message}</div>}</div><div className="rows">{posts.map(p=><div className="row" key={p.id}><div><strong>{p.title}</strong><small>{p.content_type} · {new Date(p.created_at).toLocaleDateString()}</small></div><span className="badge">{p.approval_status}</span><span className="channel">{p.status}</span></div>)}{!posts.length && <div className="muted" style={{padding:18}}>No content records visible yet. Sign in and create the first draft.</div>}</div></div>
          <div className="panel"><div className="panelhead"><h2>Campaign Command</h2><span className="pill">{campaigns.length} RECORDS</span></div><div className="composer"><input className="input" placeholder="Campaign name" value={campaignName} onChange={e=>setCampaignName(e.target.value)}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><select className="input" value={campaignObjective} onChange={e=>setCampaignObjective(e.target.value)}><option value="awareness">Awareness</option><option value="engagement">Engagement</option><option value="leads">Leads</option><option value="sales">Sales</option><option value="traffic">Traffic</option></select><input className="input" placeholder="Offer (optional)" value={campaignOffer} onChange={e=>setCampaignOffer(e.target.value)}/></div><div className="actions"><span className="muted">Campaigns are created as drafts for controlled execution.</span><button className="btn primary" onClick={createCampaign} disabled={busy || !user || !workspace}>Create Campaign →</button></div></div><div className="rows">{campaigns.map(c=><div className="row" style={{gridTemplateColumns:'1fr 90px'}} key={c.id}><div><strong>{c.name}</strong><small>{c.objective}{c.offer?' · '+c.offer:''}</small></div><span className="badge gray">{c.status}</span></div>)}{!campaigns.length && <div className="muted" style={{padding:18}}>Campaigns will appear here when workspace data is connected.</div>}</div></div>
        </div>
        <div className="modulegrid">{modules.map(([n,t,d])=><div className="module" key={t}><div><span className="eyebrow">{n}</span> <b>{t}</b></div><p>{d}</p></div>)}</div>
        <div className="footer">IZAKHONO SOCIAL COMMAND™ · OWNED-FIRST · AFRICAN-FIRST · GLOBAL-READY · OFFER → CAMPAIGN → CONTENT → LEAD → REVENUE</div>
      </section>
    </div>
  </main>
}
