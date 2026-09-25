import { IzakhonoOneEngine } from './engine.js';
const searchInput=document.querySelector('#search');
const grid=document.querySelector('#services');
const status=document.querySelector('#engine-status');
const count=document.querySelector('#service-count');
function esc(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function render(engine,services){
  count.textContent=services.length+' services';
  grid.innerHTML=services.map(service=>{
    const open=engine.route(service.slug);
    const action=open.ok?'<a class="button" href="'+esc(open.url)+'">Open resilience route</a>':'<span class="gate">Public route gated</span>';
    return '<article class="card" id="service-'+esc(service.slug)+'"><div class="category">'+esc(service.category)+'</div><h3>'+esc(service.name)+'</h3><p>'+esc(service.description)+'</p><div class="card-footer"><span class="state state-'+esc(service.status)+'">'+esc(service.status)+'</span>'+action+'</div></article>';
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
