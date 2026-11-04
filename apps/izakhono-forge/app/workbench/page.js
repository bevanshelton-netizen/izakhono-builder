'use client';
import { useMemo, useState } from 'react';

const initial = [
  { id: 1, type: 'nav', title: 'IZAKHONO AFRICA', body: 'Manufacturing • Technology • Enterprise', tone: 'dark' },
  { id: 2, type: 'hero', title: 'Built in Africa. Ready for the world.', body: 'A new standard in African manufacturing and digital innovation.', tone: 'green' },
  { id: 3, type: 'feature', title: 'What we do', body: 'Clothing & uniforms | Digital platforms | Enterprise services', tone: 'light' },
  { id: 4, type: 'cta', title: 'Let’s build something meaningful.', body: 'Talk to our team about your next project.', tone: 'dark' },
];
const presets = {
  hero: { title: 'A bold new headline', body: 'Describe the value you deliver in one clear sentence.', tone: 'green' },
  feature: { title: 'A new section', body: 'Explain a product, service or capability.', tone: 'light' },
  cta: { title: 'Ready to get started?', body: 'Give visitors one clear next step.', tone: 'dark' },
  text: { title: 'Our story', body: 'Add the detail your audience needs to know.', tone: 'light' },
};
const styles = {
  shell:{minHeight:'100vh',background:'#080d0b',color:'#edf5f1',fontFamily:'Inter,system-ui,sans-serif'},
  top:{height:68,borderBottom:'1px solid #24352e',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',position:'sticky',top:0,background:'#080d0bf2',zIndex:3},
  brand:{fontWeight:900,letterSpacing:'.12em',fontSize:13}, muted:{color:'#81958c',fontSize:12},
  button:{border:'1px solid #355247',background:'#101b16',color:'#dcebe4',padding:'10px 13px',borderRadius:9,cursor:'pointer',fontSize:12},
  primary:{border:0,background:'#62d9a7',color:'#07130d',padding:'11px 16px',borderRadius:9,cursor:'pointer',fontWeight:800,fontSize:12},
  grid:{display:'grid',gridTemplateColumns:'220px minmax(320px,1fr) 260px',gap:14,padding:16,maxWidth:1600,margin:'0 auto'},
  panel:{background:'#0e1713',border:'1px solid #22332b',borderRadius:14,padding:15,minHeight:600},
  label:{fontSize:10,letterSpacing:'.16em',color:'#62d9a7',fontWeight:800},
  input:{width:'100%',background:'#09110d',border:'1px solid #30443a',borderRadius:8,padding:10,color:'#edf5f1',fontSize:13,marginTop:7,boxSizing:'border-box'},
};
function downloadHtml(blocks) {
  const sections = blocks.map(b => {
    const bg = b.tone === 'green' ? '#103d2e' : b.tone === 'dark' ? '#101a16' : '#f0f5f1';
    const fg = b.tone === 'light' ? '#14231b' : '#f4fff9';
    return '<section style="padding:64px 8%;background:'+bg+';color:'+fg+';font-family:Arial,sans-serif"><h1>'+escapeHtml(b.title)+'</h1><p>'+escapeHtml(b.body)+'</p></section>';
  }).join('');
  const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IZAKHONO Studio Export</title></head><body style="margin:0">'+sections+'</body></html>';
  const url=URL.createObjectURL(new Blob([html],{type:'text/html'})); const a=document.createElement('a'); a.href=url; a.download='izakhono-studio-preview.html'; a.click(); URL.revokeObjectURL(url);
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

export default function Workbench(){
  const [blocks,setBlocks]=useState(initial); const [selected,setSelected]=useState(2); const [device,setDevice]=useState('desktop'); const [notice,setNotice]=useState('Local visual draft — changes stay in this browser session.');
  const active=blocks.find(b=>b.id===selected)||blocks[0];
  const count=useMemo(()=>blocks.length,[blocks]);
  function patch(key,value){setBlocks(old=>old.map(b=>b.id===selected?{...b,[key]:value}:b));}
  function add(type){const item={id:Date.now(),type,...(presets[type]||presets.text)};setBlocks(old=>[...old,item]);setSelected(item.id);}
  function move(id,dir){setBlocks(old=>{const i=old.findIndex(x=>x.id===id),j=i+dir;if(j<0||j>=old.length)return old;const a=[...old];[a[i],a[j]]=[a[j],a[i]];return a;});}
  function remove(){if(blocks.length<2)return;setBlocks(old=>old.filter(b=>b.id!==selected));setSelected(blocks.find(b=>b.id!==selected)?.id);}
  return <main style={styles.shell}>
    <header style={styles.top}><div style={styles.brand}><span style={{color:'#62d9a7'}}>I</span> IZAKHONO <span style={{color:'#62d9a7'}}>STUDIO</span> <span style={styles.muted}>/ VISUAL WORKBENCH</span></div><div style={{display:'flex',gap:8,alignItems:'center'}}><a href="/" style={{...styles.button,textDecoration:'none'}}>← Forge</a><button style={styles.button} onClick={()=>{setBlocks(initial);setSelected(2);setNotice('Starter layout restored.');}}>Reset</button><button style={styles.primary} onClick={()=>{downloadHtml(blocks);setNotice('HTML preview export created on this device.');}}>Export HTML ↓</button></div></header>
    <div style={{padding:'18px 24px 0',display:'flex',justifyContent:'space-between',alignItems:'end',gap:12,flexWrap:'wrap'}}><div><div style={styles.label}>DESIGN WITHOUT A CREDIT METER</div><h1 style={{fontSize:26,margin:'7px 0'}}>Visual workbench</h1><div style={styles.muted}>Arrange sections, edit copy and inspect a responsive preview. {count} sections.</div></div><div style={styles.muted}>{notice}</div></div>
    <div style={styles.grid}>
      <aside style={styles.panel}><div style={styles.label}>ADD TO PAGE</div><div style={{display:'grid',gap:8,marginTop:12}}>{[['hero','Hero section'],['feature','Feature section'],['text','Text section'],['cta','Call to action']].map(([t,l])=><button key={t} style={styles.button} onClick={()=>add(t)}>＋ {l}</button>)}</div><div style={{...styles.label,marginTop:28}}>PAGE STRUCTURE</div><div style={{display:'grid',gap:7,marginTop:12}}>{blocks.map((b,i)=><div key={b.id} style={{display:'flex',gap:5}}><button onClick={()=>setSelected(b.id)} style={{...styles.button,flex:1,textAlign:'left',borderColor:selected===b.id?'#62d9a7':'#304238',background:selected===b.id?'#153326':'#09110d'}}><small style={{color:'#62d9a7'}}>{String(i+1).padStart(2,'0')} · {b.type.toUpperCase()}</small><br/>{b.title}</button><div style={{display:'grid',gap:3}}><button style={styles.button} onClick={()=>move(b.id,-1)}>↑</button><button style={styles.button} onClick={()=>move(b.id,1)}>↓</button></div></div>)}</div></aside>
      <section style={{...styles.panel,padding:12,background:'#0a100d'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 5px 12px'}}><div style={styles.label}>LIVE CANVAS · PREVIEW</div><div style={{display:'flex',gap:5}}><button style={{...styles.button,borderColor:device==='desktop'?'#62d9a7':'#30443a'}} onClick={()=>setDevice('desktop')}>Desktop</button><button style={{...styles.button,borderColor:device==='mobile'?'#62d9a7':'#30443a'}} onClick={()=>setDevice('mobile')}>Mobile</button></div></div><div style={{margin:'0 auto',width:device==='mobile'?'min(100%,390px)':'100%',background:'#f0f5f1',borderRadius:12,overflow:'hidden',minHeight:520,transition:'width .2s'}}>{blocks.map((b,i)=>{const bg=b.tone==='green'?'#103d2e':b.tone==='dark'?'#101a16':'#f0f5f1',fg=b.tone==='light'?'#14231b':'#f4fff9';return <article key={b.id} onClick={()=>setSelected(b.id)} style={{padding:b.type==='hero'?'70px 8%':'38px 8%',background:bg,color:fg,border:selected===b.id?'3px solid #62d9a7':'3px solid transparent',cursor:'pointer',textAlign:b.type==='hero'?'center':'left'}}><div style={{fontSize:10,letterSpacing:'.16em',opacity:.65,marginBottom:12}}>{b.type==='nav'?'IZAKHONO AFRICA':b.type==='hero'?'AFRICAN AMBITION · GLOBAL STANDARD':''}</div><h2 style={{fontSize:b.type==='hero'?'clamp(28px,4vw,48px)':24,lineHeight:1.08,margin:'0 0 14px'}}>{b.title}</h2><p style={{fontSize:15,lineHeight:1.6,opacity:.78,margin:0}}>{b.body}</p></article>})}</div></section>
      <aside style={styles.panel}><div style={styles.label}>INSPECTOR</div>{active?<><div style={{fontSize:11,color:'#80948b',marginTop:8}}>Selected: {active.type}</div><label style={{display:'block',fontSize:11,marginTop:20}}>Heading<input style={styles.input} value={active.title} onChange={e=>patch('title',e.target.value)}/></label><label style={{display:'block',fontSize:11,marginTop:15}}>Description<textarea style={{...styles.input,minHeight:110,resize:'vertical'}} value={active.body} onChange={e=>patch('body',e.target.value)}/></label><label style={{display:'block',fontSize:11,marginTop:15}}>Colour treatment<select style={styles.input} value={active.tone} onChange={e=>patch('tone',e.target.value)}><option value="green">African green</option><option value="dark">Deep charcoal</option><option value="light">Light canvas</option></select></label><button style={{...styles.button,width:'100%',marginTop:22,color:'#ffaaa2',borderColor:'#65413b'}} onClick={remove}>Remove section</button></>:<p style={styles.muted}>Select a section to edit.</p>}<div style={{borderTop:'1px solid #26382f',marginTop:28,paddingTop:18}}><div style={styles.label}>WORKBENCH STATUS</div><p style={{...styles.muted,lineHeight:1.7}}>Canvas editing: local<br/>Export: static HTML<br/>Cloud save: not connected<br/>Build execution: controlled by Forge API</p></div></aside>
    </div>
    <footer style={{padding:'20px 24px',borderTop:'1px solid #22332b',color:'#60746a',fontSize:11}}>IZAKHONO BUILDER · VISUAL ENGINE FOUNDATION · Drafts are not published until verified through the release pipeline.</footer>
  </main>;
}
