(function(){
"use strict";
var STORE="izakhono.clothing.quote.requests";
function endpoints(){
  var m=document.querySelector('meta[name="izakhono-fabric-endpoint"]');
  var primary=String(window.IZAKHONO_FABRIC_ENDPOINT||(m&&m.content)||"").replace(/\/$/,"");
  var external="https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-gateway-event";
  var out=[];if(primary)out.push(primary);if(out.indexOf(external)===-1)out.push(external);return out
}
function ref(){return window.crypto&&crypto.randomUUID?"quote-"+crypto.randomUUID():"quote-"+Date.now()+"-"+Math.random().toString(16).slice(2)}
function read(){try{return JSON.parse(localStorage.getItem(STORE)||"[]")}catch{return[]}}
function save(record){var rows=read();rows.push(record);localStorage.setItem(STORE,JSON.stringify(rows.slice(-250)))}
function serialize(form){var out={};new FormData(form).forEach(function(v,k){out[k]=String(v)});return out}
function show(message){var s=document.getElementById("status");s.textContent=message;s.style.display="block"}
async function emit(record){
  var bases=endpoints(),d=record.data,last=null;
  var body={
    fabric_bridge:true,platform_id:"izakhono-clothing",event_type:"quote.requested",subject_ref:record.id,
    contact:{name:d.name,email:d.email,phone:d.phone,company:d.company,role:"buyer / procurement contact",source:"clothing-quote-web"},
    opportunity:{title:(d.company||d.name)+" — "+d.product+" quote",value:0,currency:"ZAR",next_action:"Qualify quantity, sizes, branding and deadline",source:"clothing-quote-web"},
    note:"Quantity: "+d.quantity+"; deadline: "+(d.deadline||"not supplied")+"; preferred contact: "+d.contact_method+"; specification: "+d.spec+"; notes: "+(d.notes||"")
  };
  for(var i=0;i<bases.length;i++){
    var base=bases[i],url=/supabase\.co\/functions\/v1\//.test(base)?base:base+"/api/fabric/intake";
    try{
      var r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      var result=await r.json().catch(function(){return{}});
      if(r.ok||r.status===202)return Object.assign({route:i===0&&bases.length>1?"primary":"external-resilience"},result);
      last=new Error("fabric_"+r.status);
    }catch(error){last=error}
  }
  return{queuedLocally:true,error:last?String(last.message||last):"fabric unavailable"}
}
document.getElementById("quoteForm").addEventListener("submit",async function(e){
  e.preventDefault();var record={id:ref(),created_at:new Date().toISOString(),data:serialize(e.currentTarget)};save(record);
  var result=await emit(record);e.currentTarget.reset();
  show(result&&result.delivery==="crm"?"Quote request received and added to our sales pipeline.":"Quote request saved. Our team can follow up once the sales gateway is available.");
});
})(); 
