const grid=document.querySelector('#service-grid');
const search=document.querySelector('#search');
const count=document.querySelector('#service-count');
const status=document.querySelector('#engine-status');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parallel=[
{slug:'search',name:'IZAKHONO SEARCH',category:'Discovery',icon:'⌕',description:'African-first web, local, business, product and content discovery with AI answers and private search.',status:'foundation',path:'/search',actions:['Search the web','Find African businesses','Discover products and services']},
{slug:'connecta',name:'CONNECTA',category:'Community',icon:'◉',description:'Social network, communities, messaging, creators, business pages, jobs and marketplace connections.',status:'foundation',path:'/connecta',actions:['Create a profile','Join communities','Connect creators and businesses']},
{slug:'ai',name:'ONE AI',category:'Intelligence',icon:'✦',description:'Personal, business, school and developer intelligence with creation, analysis and automation.',status:'foundation',path:'/ai',actions:['Ask ONE AI','Create content','Automate work']},
{slug:'cloud',name:'ONE CLOUD',category:'Workspace',icon:'☁',description:'Files, documents, sheets, presentations, mail, calendar and team collaboration.',status:'foundation',path:'/cloud',actions:['Store files','Create documents','Collaborate with teams']},
{slug:'commerce',name:'ONE COMMERCE',category:'Commerce',icon:'◇',description:'Marketplace, storefronts, payments, invoicing, digital products and controlled advertising.',status:'foundation',path:'/commerce',actions:['Open a storefront','Create an invoice','Sell products and services']},
{slug:'nav',name:'IZAKHONO NAV',category:'Mobility & Safety',icon:'⌖',description:'Navigation, driver safety, emergency response, fleet intelligence and African road intelligence.',status:'foundation',path:'/nav',actions:['Plan a journey','Activate safety tools','Manage fleet intelligence']},
{slug:'fortress',name:'FORTRESS',category:'Security',icon:'◆',description:'Identity protection, fraud signals, device intelligence, permissions and security audit.',status:'foundation',path:'/fortress',actions:['Protect identity','Review security','Manage permissions']}
];
let services=[];
function render(list){
 count.textContent=`${list.length} services · 7 parallel pillars`;
 grid.innerHTML=list.map(s=>`<article class="service" id="service-${esc(s.slug)}"><div class="service-icon">${s.icon}</div><div class="service-body"><div class="service-meta"><span>${esc(s.category)}</span><em>${esc(s.status)}</em></div><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><div class="service-actions">${(s.actions||[]).map(a=>`<span>${esc(a)}</span>`).join('')}</div><a class="open" href="${esc(s.path)}">Enter service →</a></div></article>`).join('')}
function activateFromRoute(){
 const slug=new URLSearchParams(location.search).get('service');
 if(!slug)return;
 const item=parallel.find(s=>s.slug===slug);
 if(!item)return;
 const hero=document.querySelector('.hero-copy');
 if(hero){
  const heading=hero.querySelector('h1');
  const desc=hero.querySelector('p');
  if(heading)heading.innerHTML=`${esc(item.name)}<br><span>${esc(item.category)}</span>`;
  if(desc)desc.textContent=item.description;
 }
 const target=document.querySelector('#service-'+CSS.escape(item.slug));
 if(target){setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'center'}),80);target.classList.add('focus-service')}
}
async function boot(){
 try{
  const r=await fetch('./registry.json',{cache:'no-store'});
  const data=await r.json();
  const registry=Array.isArray(data.services)?data.services:[];
  services=[...parallel,...registry.filter(s=>!parallel.some(p=>p.name===s.name))];
  status.textContent='● ONE ENGINE READY';status.classList.add('ready');render(services);activateFromRoute();
 }catch{status.textContent='● DEGRADED';render(parallel);activateFromRoute()}
}
search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();render(!q?services:services.filter(s=>[s.name,s.category,s.description,...(s.actions||[])].join(' ').toLowerCase().includes(q)))});
boot();