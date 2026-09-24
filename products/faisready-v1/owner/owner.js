(()=>{
"use strict";
const $=id=>document.getElementById(id);
const tokenKey="faisready.owner.access";
function token(){return sessionStorage.getItem(tokenKey)||"";}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2600);}
async function api(url,options={}){
  const headers={"content-type":"application/json",...(options.headers||{})};
  if(token()) headers.authorization="Bearer "+token();
  const r=await fetch(url,{...options,headers});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw Object.assign(new Error(data.error||"Request failed"),{status:r.status});
  return data;
}
function money(v){return new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR",maximumFractionDigits:0}).format(Number(v||0));}
function date(v){if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleString("en-ZA");}
function row(texts){const tr=document.createElement("tr");texts.forEach(t=>{const td=document.createElement("td");td.textContent=String(t??"");tr.appendChild(td);});return tr;}
async function load(){
  const data=await api("/api/owner/summary");
  $("loginPanel").hidden=true;$("portal").hidden=false;
  $("ownerIdentity").textContent=data.user?.email||"FAISReady Owner";
  $("statContacts").textContent=data.summary?.contacts||0;
  $("statOpen").textContent=data.summary?.open_deals||0;
  $("statPipeline").textContent=money(data.summary?.pipeline_value||0);
  $("statMerch").textContent=(data.merch_orders||[]).length;
  const merch=$("merchRows");merch.textContent="";
  (data.merch_orders||[]).forEach(d=>merch.appendChild(row([d.title,money(d.value),d.stage,d.next_action])));
  if(!merch.children.length) merch.appendChild(row(["No merchandise orders yet","","",""]));
  const deals=$("dealRows");deals.textContent="";
  (data.deals||[]).slice(0,20).forEach(d=>deals.appendChild(row([d.title,money(d.value),d.stage,date(d.updated_at||d.created_at)])));
  if(!deals.children.length) deals.appendChild(row(["No CRM opportunities yet","","",""]));
  const list=$("ownerInsights");list.textContent="";
  (data.insights?.recommendations||["No urgent owner actions detected."]).forEach(x=>{const li=document.createElement("li");li.textContent=x;list.appendChild(li);});
}
$("ownerLogin").addEventListener("submit",async e=>{
  e.preventDefault();$("loginStatus").textContent="Signing in…";
  const fd=new FormData(e.currentTarget);
  try{
    const data=await api("/api/owner/signin",{method:"POST",body:JSON.stringify({email:fd.get("email"),password:fd.get("password")})});
    sessionStorage.setItem(tokenKey,data.access_token);e.currentTarget.reset();await load();toast("Owner portal unlocked");
  }catch(err){$("loginStatus").textContent=err.message;toast(err.message);}
});
$("refreshOwner").addEventListener("click",()=>load().then(()=>toast("Owner data refreshed")).catch(e=>toast(e.message)));
$("signOutOwner").addEventListener("click",()=>{sessionStorage.removeItem(tokenKey);$("portal").hidden=true;$("loginPanel").hidden=false;$("loginStatus").textContent="Signed out.";});
if(token()) load().catch(()=>sessionStorage.removeItem(tokenKey));
})();
