'use client';
import { useState } from 'react';

const modules = [
  ['01','Forge','Turn plain language into an executable build.'],
  ['02','Web Factory','Websites, portals and landing pages.'],
  ['03','App Factory','Production-ready application scaffolds.'],
  ['04','CRM Factory','Provision tenant-safe business CRMs.'],
  ['05','Studio','Documents, decks, images and campaign assets.'],
  ['06','Research','Deep research and evidence synthesis.'],
  ['07','Agent Mesh','Specialist agents with routing and verification.'],
  ['08','Deploy','Preview, verify, publish and rollback.'],
];

const starterPrompts = [
  'Build a professional IZAKHONO AFRICA manufacturing website with procurement, products, capabilities and lead capture.',
  'Create a CRM for Izakhono Africa with companies, contacts, sales pipeline, tasks and AI follow-up.',
  'Build a customer portal that takes a paid order through domain, website, email and onboarding provisioning.',
];

export default function Home() {
  const [intent, setIntent] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);

  async function run() {
    if (!intent.trim()) return;
    setBusy(true); setResult(null);
    try {
      const r = await fetch('/api/plan', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({intent}) });
      const data = await r.json();
      setResult(data);
      setHistory(h => [{ intent, type: data.plan?.type || 'BUILD', time: new Date().toLocaleTimeString() }, ...h].slice(0,8));
    } finally { setBusy(false); }
  }

  return <main>
    <nav className="nav"><div className="brand"><span className="mark">I</span> IZAKHONO <b>FORGE</b><small>×20</small></div><div className="navlinks"><span>Command</span><span>Factories</span><span>Agents</span><span>Deployments</span></div><div className="status"><i/> OWNED CORE</div></nav>
    <section className="hero">
      <div className="eyebrow">THE IZAKHONO OUTCOME ENGINE</div>
      <h1>Tell it what you want.<br/><em>We build the system.</em></h1>
      <p className="lede">A Vincen-class builder, redesigned as infrastructure: one command surface for websites, apps, CRMs, documents, research, marketing, agents and deployment — with IZAKHONO owning the orchestration layer.</p>
      <div className="composer">
        <div className="prompticon">✦</div><textarea value={intent} onChange={e=>setIntent(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();run()}}} placeholder="Describe the outcome you want built…" />
        <button onClick={run} disabled={busy}>{busy ? 'BUILDING…' : 'BUILD →'}</button>
      </div>
      <div className="chips">{starterPrompts.map((p,i)=><button key={i} onClick={()=>setIntent(p)}>{['Website','CRM','Provisioner'][i]}</button>)}</div>
    </section>

    <section className="workspace">
      <div className="panel mainpanel">
        <div className="panelhead"><div><span className="kicker">EXECUTION FABRIC</span><h2>One command. Multiple specialist engines.</h2></div><span className="live">● READY</span></div>
        <div className="modulegrid">{modules.map(([n,t,d])=><div className="module" key={n}><span>{n}</span><strong>{t}</strong><p>{d}</p></div>)}</div>
      </div>
      <div className="panel resultpanel">
        <div className="panelhead"><div><span className="kicker">LIVE PLAN</span><h2>{result ? result.plan?.type || 'Execution' : 'Waiting for a command'}</h2></div></div>
        {!result ? <div className="empty"><div className="orb">✦</div><p>Forge will classify the request, choose the right factory, create an execution plan and return a machine-readable handoff.</p></div> : <div className="plan"><div className="source">SOURCE: {result.source}</div>{(result.plan?.stages || []).map(([name,desc],i)=><div className="step" key={name}><span>{String(i+1).padStart(2,'0')}</span><div><b>{name}</b><p>{desc}</p></div></div>)}<div className="guard"><b>GUARDRAILS</b>{(result.plan?.safety||[]).map(x=><div key={x}>✓ {x}</div>)}</div></div>}
      </div>
    </section>

    <section className="lower"><div><span className="kicker">RECENT BUILDS</span>{history.length ? history.map((x,i)=><div className="history" key={i}><b>{x.type}</b><span>{x.intent}</span><time>{x.time}</time></div>) : <p className="muted">Your execution history will appear here.</p>}</div><div className="x20"><span className="kicker">WHY ×20</span><h2>Not another chatbot.</h2><p>Forge is designed as a business-building operating system: planner → agents → factories → connectors → verification → deployment → memory.</p><div className="tags"><span>MODEL-AGNOSTIC</span><span>OWNED-FIRST</span><span>REVERSIBLE</span><span>AUDITABLE</span></div></div></section>
    <footer>IZAKHONO FORGE ×20 · Outcome infrastructure for the IZAKHONO ecosystem · v0.1 foundation</footer>
  </main>
}
