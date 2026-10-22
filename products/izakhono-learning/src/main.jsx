import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const courses = [
  { title:'ECD NQF Level 4', academy:'Edu-Build Institute', type:'Qualification', duration:'12 months', level:'NQF 4', price:'R13,000', icon:'🎓' },
  { title:'ECD NQF Level 5', academy:'Edu-Build Institute', type:'Qualification', duration:'18 months', level:'NQF 5', price:'R15,000', icon:'📚' },
  { title:'Inclusive Education NQF Level 5', academy:'Edu-Build Institute', type:'Qualification', duration:'18 months', level:'NQF 5', price:'Enquire', icon:'🧩' },
  { title:'The Business of Music', academy:'IZAKHONO Creative Academy', type:'Professional Course', duration:'Self-paced', level:'Professional', price:'Available soon', icon:'🎵' },
  { title:'Clothing Manufacturing', academy:'IZAKHONO Skills Academy', type:'Skills Course', duration:'Self-paced', level:'Skills', price:'Available soon', icon:'🧵' },
  { title:'Furniture Manufacturing & Upholstery', academy:'IZAKHONO Skills Academy', type:'Skills Course', duration:'Self-paced', level:'Skills', price:'Available soon', icon:'🪑' },
  { title:'Diamond Valuation & Beneficiation', academy:'IZAKHONO Diamond Academy', type:'Professional Course', duration:'Instructor-led', level:'Professional', price:'Available soon', icon:'💎' },
  { title:'Poultry & Egg Production', academy:'IZAKHONO Agri Academy', type:'Agriculture', duration:'Self-paced', level:'Practical', price:'Available soon', icon:'🐔' },
  { title:'Entrepreneurship & Business Development', academy:'IZAKHONO Business Academy', type:'Business', duration:'Self-paced', level:'Professional', price:'Available soon', icon:'🚀' },
  { title:'Technology & Digital Skills', academy:'IZAKHONO Digital Academy', type:'Technology', duration:'Self-paced', level:'Practical', price:'Available soon', icon:'💻' },
];

function App(){
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('All');
  const categories=['All',...new Set(courses.map(c=>c.type))];
  const filtered=useMemo(()=>courses.filter(c=>(filter==='All'||c.type===filter)&&`${c.title} ${c.academy}`.toLowerCase().includes(query.toLowerCase())),[query,filter]);
  return <div className="app">
    <header className="nav"><div className="brand"><span className="mark">I</span><span>IZAKHONO <b>LEARNING</b></span></div><nav><a href="#courses">Courses</a><a href="#academies">Academies</a><a href="#live">Live</a></nav><button className="login">Learner Login</button></header>
    <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow">ONE LEARNING NETWORK • MANY ACADEMIES</p><h1>Learn anywhere.<br/><span>Build your future.</span></h1><p className="lead">One home for all IZAKHONO courses — qualifications, professional training, practical skills and live learning.</p><div className="actions"><a className="primary" href="#courses">Explore Courses</a><a className="secondary" href="#academies">View Academies</a></div></div><div className="hero-card"><div className="screen"><div className="screen-top">IZAKHONO LEARNING <span>LIVE</span></div><div className="play">▶</div><strong>Learning across every screen</strong><small>Web • Mobile • TV • Live</small></div></div></section>
      <section className="stats"><div><b>10+</b><span>Courses & programmes</span></div><div><b>10</b><span>Learning areas</span></div><div><b>24/7</b><span>Self-paced access</span></div><div><b>1</b><span>IZAKHONO learner account</span></div></section>
      <section id="courses" className="section"><div className="section-head"><div><p className="eyebrow">COURSE LIBRARY</p><h2>Start learning</h2></div><input aria-label="Search courses" placeholder="Search courses..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="filters">{categories.map(c=><button className={filter===c?'active':''} onClick={()=>setFilter(c)} key={c}>{c}</button>)}</div><div className="grid">{filtered.map(c=><article className="course" key={c.title}><div className="icon">{c.icon}</div><div className="tag">{c.type}</div><h3>{c.title}</h3><p>{c.academy}</p><div className="meta"><span>{c.duration}</span><span>{c.level}</span></div><div className="course-foot"><strong>{c.price}</strong><button>View Course</button></div></article>)}</div></section>
      <section id="academies" className="academy"><p className="eyebrow">ONE PLATFORM</p><h2>Multiple academies. One learner journey.</h2><p>IZAKHONO Learning is designed to bring the full training portfolio into one discoverable, mobile-first experience while preserving each academy's identity and accreditation boundaries.</p></section>
      <section id="live" className="live"><div><p className="eyebrow">LIVE LEARNING</p><h2>Classes, workshops and events</h2><p>Prepare for live teaching, practical demonstrations and streamed learning as the platform expands.</p></div><div className="live-pill">● LIVE READY</div></section>
    </main>
    <footer>© 2026 IZAKHONO Learning • Owned-first education platform</footer>
  </div>
}
createRoot(document.getElementById('root')).render(<App />);
