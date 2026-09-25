import { IzakhonoOneEngine } from './engine.js';
const searchInput=document.querySelector('#search');
const grid=document.querySelector('#services');
const status=document.querySelector('#engine-status');
const count=document.querySelector('#service-count');
function esc(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function sortServices(services){
  return [...services].sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))||a.name.localeCompare(b.name));
}
function render(engine,services){
  const sorted=sortServices(services);
  count.textContent=sorted.length+' services';
  grid.innerHTML=sorted.map(service=>{
    const open=engine.route(service.slug);
    const action=open.ok
      ? '<a class="button" href="'+esc(open.url)+'">Open verified route</a>'
      : '<span class="gate">'+(service.featured?'Launch gate pending':'Public route gated')+'</span>';
    const feature=service.featured?'<span class="featured">FLAGSHIP</span>':'';
    return '<article class="card '+(service.featured?'card-featured':'')+'" id="service-'+esc(service.slug)+'"><div class="card-top"><div class="category">'+esc(service.category)+'</div>'+feature+'</div><h3>'+esc(service.name)+'</h3><p>'+esc(service.description)+'</p><div class="card-footer"><span class="state state-'+esc(service.status)+'">'+esc(service.status)+'</span>'+action+'</div></article>';
  }).join('');
}
try{
  const engine=await IzakhonoOneEngine.boot();
  const health=engine.health();
  status.textContent='ENGINE '+health.status.toUpperCase()+' • NO TRACKING';
  render(engine,engine.search());
  searchInput.addEventListener('input',event=>render(engine,engine.search(event.target.value)));
}catch{
  status.textContent='ENGINE DEGRADED';
  grid.innerHTML='<div class="error">The service registry could not be loaded. No unverified route was opened.</div>';
}
