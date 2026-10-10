const grid=document.querySelector('#service-grid');
const search=document.querySelector('#search');
const count=document.querySelector('#service-count');
const status=document.querySelector('#engine-status');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let services=[];
const parallel=[
{slug:'search',name:'IZAKHONO SEARCH',category:'Discovery',icon:'⌕',description:'African-first web, local, business, product and content discovery with AI answers and private search.',status:'foundation',path:'/search'},
{slug:'connecta',name:'CONNECTA',category:'Community',icon:'◉',description:'Social network, communities, messaging, creators, business pages, jobs and marketplace connections.',status:'foundation',path:'/connecta'},
{slug:'ai',name:'ONE AI',category:'Intelligence',icon:'✦',description:'Personal, business, school and developer intelligence with creation, analysis and automation.',status:'foundation',path:'/ai'},
{slug:'cloud',name:'ONE CLOUD',category:'Workspace',icon:'☁',description:'Files, documents, sheets, presentations, mail, calendar and team collaboration.',status:'foundation',path:'/cloud'},
{slug:'commerce',name:'ONE COMMERCE',category:'Commerce',icon:'◇',description:'Marketplace, storefronts, payments, invoicing, digital products and controlled advertising.',status:'foundation',path:'/commerce'},
{slug:'nav',name:'IZAKHONO NAV',category:'Mobility & Safety',icon:'⌖',description:'Navigation, driver safety, emergency response, fleet intelligence and African road intelligence.',status:'foundation',path:'/nav'},
{slug:'fortress',name:'FORTRESS',category:'Security',icon:'◆',description:'Identity protection, fraud signals, device intelligence, permissions and security audit.',status:'foundation',path:'/fortress'}
];
function render(list){count.textContent=`${list.length} services · 7 parallel pillars`;grid.innerHTML=list.map(s=>`<article class="service"><div class="service-icon">${s.icon}</div><div class="service-body"><div class="service-meta"><span>${esc(s.category)}</span><em>${esc(s.status)}</em></div><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><a class="open" href="${esc(s.path)}">Enter service →</a></div></article>`).join('')}
async function boot(){try{const r=await fetch('./registry.json',{cache:'no-store'});const data=await r.json();services=[...parallel,...data.services.filter(s=>!parallel.some(p=>p.name===s.name))];status.textContent='● ONE ENGINE READY';status.classList.add('ready');render(services)}catch{status.textContent='● DEGRADED';render(parallel)}}
search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();render(!q?services:services.filter(s=>[s.name,s.category,s.description].join(' ').toLowerCase().includes(q)))});boot();