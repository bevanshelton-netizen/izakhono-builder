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
      const r = await fetch('/api/forge', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({prompt:intent}) });
      const data = await r.json();
      setResult(data);
      setHistory(h => [{ intent, type: data.job?.intent || 'BUILD', status: data.job?.status || 'QUEUED', persisted: data.persisted, time: new Date().toLocaleTimeString() }, ...h].slice(0,8));
    } catch (error) {
      setResult({ error: 'forge_unavailable', detail: error instanceof Error ? error.message : 'unknown_error' });
    } finally { setBusy(false); }
  }

  return <main>
    <nav className="nav"><div className="brand"><span className="mark">I</span> IZAKHONO <b>FORGE</b><small>×20</small></div><div className="navlinks"><span>Command</span><a href="/workbench" style={{color:"#8de6c2",textDecoration:"none"}}>Visual Studio ↗</a><span>Factories</span><span>Agents</span><span>Deployments</span></div><div className="status"><i/> OWNED CORE</div></nav>
    <section className="hero">
      <div className="eyebrow">THE IZAKHONO OUTCOME ENGINE</div>
      <h1>Tell it what you want.<br/><em>We build the system.</em></h1>
      <p className="lede">A Vincen-class builder, redesigned as infrastructure: one command surface for websites, apps, CRMs, documents, research, marketing, agents and deployment — with IZAKHONO owning the orchestration layer.</p>
      <div className="composer">
        <div className="prompticon">✦</div><textarea value={intent} onChange={e=>setIntent(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();run()}}} placeholder="Describe the outcome you want built…" />
        <button onClick={run} disabled={busy}>{busy ? 'QUEUING…' : 'BUILD →'}</button>
      </div>
      <div className="chips">{starterPrompts.map((p,i)=><button key={i} onClick={()=>setIntent(p)}>{['Website','CRM','Provisioner'][i]}</button>)}</div>
    </section>

    <section className="workspace">
      <div className="panel mainpanel">
        <div className="panelhead"><div><span className="kicker">EXECUTION FABRIC</span><h2>One command. Multiple specialist engines.</h2></div><span className="live">● READY</span></div>
        <div className="modulegrid">{modules.map(([n,t,d])=><div className="module" key={n}><span>{n}</span><strong>{t}</strong><p>{d}</p></div>)}</div>
      </div>
      <div className="panel resultpanel">
        <div className="panelhead"><div><span className="kicker">JOB CONTROL</span><h2>{result?.job?.intent || 'Waiting for a command'}</h2></div></div>
        {!result ? <div className="empty"><div className="orb">✦</div><p>Forge will classify the request, queue a job, create specialist execution steps and hand the work to the control plane.</p></div> : result.error ? <div className="empty"><div className="orb">!</div><p>{result.detail || result.error}</p></div> : <div className="plan"><div className="source">SOURCE: {result.source} · {result.persisted ? 'PERSISTED' : 'LOCAL FALLBACK'}</div>{(result.job?.steps || []).map((step)=><div className="step" key={step.stepKey}><span>{String(step.order).padStart(2,'0')}</span><div><b>{step.label}</b><p>Worker: {step.workerType} · Status: {result.job.status}</p></div></div>)}<div className="guard"><b>CONTROL PLANE</b><div>✓ Queue state is explicit</div><div>✓ Specialist worker is assigned per step</div><div>✓ Execution remains auditable and reversible</div><div>✓ High-impact actions remain authorization-gated</div></div></div>}
      </div>
    </section>

    <section className="lower"><div><span className="kicker">RECENT BUILDS</span>{history.length ? history.map((x,i)=><div className="history" key={i}><b>{x.type}</b><span>{x.intent}</span><time>{x.status} · {x.persisted ? 'DB' : 'LOCAL'} · {x.time}</time></div>) : <p className="muted">Your execution history will appear here.</p>}</div><div className="x20"><span className="kicker">WHY ×20</span><h2>Not another chatbot.</h2><p>Forge is designed as a business-building operating system: planner → agents → factories → connectors → verification → deployment → memory.</p><div className="tags"><span>MODEL-AGNOSTIC</span><span>OWNED-FIRST</span><span>REVERSIBLE</span><span>AUDITABLE</span></div></div></section>
    <footer>IZAKHONO FORGE ×20 · Outcome infrastructure for the IZAKHONO ecosystem · v0.2 control plane</footer>
  </main>
}
