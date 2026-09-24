(function(){
"use strict";
var STORE="izakhono.clothing.quote.requests";
function endpoint(){var m=document.querySelector('meta[name="izakhono-fabric-endpoint"]');return String(window.IZAKHONO_FABRIC_ENDPOINT||(m&&m.content)||"").replace(/\/$/,"")}
function ref(){return window.crypto&&crypto.randomUUID?"quote-"+crypto.randomUUID():"quote-"+Date.now()+"-"+Math.random().toString(16).slice(2)}
function read(){try{return JSON.parse(localStorage.getItem(STORE)||"[]")}catch{return[]}}
function save(record){var rows=read();rows.push(record);localStorage.setItem(STORE,JSON.stringify(rows.slice(-250)))}
function serialize(form){var out={};new FormData(form).forEach(function(v,k){out[k]=String(v)});return out}
function show(message){var s=document.getElementById("status");s.textContent=message;s.style.display="block"}
async function emit(record){
  var base=endpoint();if(!base)return {skipped:true};
  var d=record.data;
  try{
    var r=await fetch(base+"/api/fabric/intake",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      platform_id:"izakhono-clothing",event_type:"quote.requested",subject_ref:record.id,
      contact:{name:d.name,email:d.email,phone:d.phone,company:d.company,role:"buyer / procurement contact",source:"clothing-quote-web"},
      opportunity:{title:(d.company||d.name)+" — "+d.product+" quote",value:0,currency:"ZAR",next_action:"Qualify quantity, sizes, branding and deadline",source:"clothing-quote-web"},
      note:"Quantity: "+d.quantity+"; deadline: "+(d.deadline||"not supplied")+"; preferred contact: "+d.contact_method+"; specification: "+d.spec+"; notes: "+(d.notes||"")
    })});
    if(!r.ok&&r.status!==202)throw new Error("fabric_"+r.status);
    return r.json().catch(function(){return{ok:true}})
  }catch{return{queuedLocally:true}}
}
document.getElementById("quoteForm").addEventListener("submit",async function(e){
  e.preventDefault();var record={id:ref(),created_at:new Date().toISOString(),data:serialize(e.currentTarget)};save(record);
  var result=await emit(record);e.currentTarget.reset();
  show(result&&result.delivery==="crm"?"Quote request received and added to our sales pipeline.":"Quote request saved. Our team can follow up once the sales gateway is available.");
});
})(); 
