const app=document.querySelector("#root");
let mode="drive", safety=true, emergency=false, panel="", monitoring=false, incident=null;
let lastSpeed=0,lastSpeedAt=0,safetyEvents=[],trustedContacts=[],journey={startedAt:new Date().toISOString(),distance:18.4,eta:23};
try{safetyEvents=JSON.parse(localStorage.getItem("izakhono_nav_events")||"[]")}catch(e){}
try{trustedContacts=JSON.parse(localStorage.getItem("izakhono_nav_contacts")||"[]")}catch(e){}
function persist(){try{localStorage.setItem("izakhono_nav_events",JSON.stringify(safetyEvents));localStorage.setItem("izakhono_nav_contacts",JSON.stringify(trustedContacts))}catch(e){}}
function recordEvent(type,severity,detail){
 safetyEvents=[{id:Date.now(),type,severity,detail,at:new Date().toISOString()},...safetyEvents].slice(0,30);persist();render();
}
function getLocation(){
 return new Promise(resolve=>{
  if(!navigator.geolocation)return resolve(null);
  navigator.geolocation.getCurrentPosition(p=>resolve({lat:+p.coords.latitude.toFixed(6),lon:+p.coords.longitude.toFixed(6),accuracy:Math.round(p.coords.accuracy)}),()=>resolve(null),{enableHighAccuracy:true,timeout:6000,maximumAge:3000});
 });
}
async function createIncident(kind){
 const loc=await getLocation();
 incident={id:"NAV-"+Date.now(),kind,status:"STAGED",createdAt:new Date().toISOString(),location:loc,dispatch:false,hijack:kind==="HIJACK"};
 emergency=false;
 recordEvent(kind==="HIJACK"?"Hijack response staged":"Emergency response staged","CRITICAL",loc?"Location captured locally; no service contacted.":"Location unavailable; no service contacted.");
 panel="incident";render();
}
function startSensors(){
 if(monitoring)return;
 monitoring=true;
 if("geolocation" in navigator){
  navigator.geolocation.watchPosition(pos=>{
   const speed=Math.max(0,(pos.coords.speed||0)*3.6),now=Date.now();
   if(lastSpeedAt&&now-lastSpeedAt>500){
    const dt=(now-lastSpeedAt)/1000,delta=(speed-lastSpeed)/dt;
    if(delta<-18&&safety)recordEvent("Hard braking candidate","HIGH","Estimated deceleration "+Math.round(Math.abs(delta)*10)/10+" m/s²");
    if(speed>120&&safety)recordEvent("Speed risk","HIGH","Estimated speed "+Math.round(speed)+" km/h");
   }
   lastSpeed=speed;lastSpeedAt=now;
  },()=>recordEvent("Location unavailable","INFO","GPS permission or signal unavailable; safety remains available locally."),{enableHighAccuracy:true,maximumAge:2000,timeout:10000});
 }
 function motion(){window.addEventListener("devicemotion",e=>{const a=e.acceleration;if(!a||!safety)return;const m=Math.sqrt((a.x||0)**2+(a.y||0)**2+(a.z||0)**2);if(m>25)recordEvent("Impact candidate","CRITICAL","Motion spike detected; verify before escalation.")})}
 if(typeof DeviceMotionEvent!=="undefined"&&typeof DeviceMotionEvent.requestPermission==="function")DeviceMotionEvent.requestPermission().then(p=>{if(p==="granted")motion()}).catch(()=>{});else motion();
 render();
}
function eventRows(){
 return safetyEvents.slice(0,6).map(e=>'<div class="eventRow"><span>'+({CRITICAL:"🔴",HIGH:"🟠",INFO:"🔵"}[e.severity]||"⚪")+'</span><div><b>'+e.type+'</b><small>'+e.detail+'</small></div></div>').join("")||'<div class="sheetNote">No safety events recorded.</div>';
}
function safetySheet(){
 return '<div class="sheet"><div class="sheetHead"><b>Safety Centre</b><button id="closePanel">✕</button></div>'+
 '<div class="sheetCard"><span>🛡️</span><div><b>Driver Safety Guardian</b><small>'+(safety?"Monitoring journey conditions":"Monitoring paused")+'</small></div><button id="sheetGuardian">'+(safety?"ON":"OFF")+'</button></div>'+
 '<div class="sheetCard"><span>📡</span><div><b>Live Sensor Engine</b><small>'+(monitoring?"GPS/motion monitoring active":"Standby — sensors not active")+'</small></div><button id="startSensors">'+(monitoring?"ACTIVE":"START")+'</button></div>'+
 '<div class="sheetCard"><span>🧪</span><div><b>Safety Test</b><small>Local test only. No emergency service is contacted.</small></div><button id="testBrake">TEST</button></div>'+
 '<div class="events"><b>Recent safety events</b>'+eventRows()+'</div>'+
 '<div class="sheetCard"><span>📴</span><div><b>Offline Event Queue</b><small>Events remain local until a verified sync adapter is connected.</small></div></div></div>';
}
function incidentSheet(){
 const i=incident;
 const loc=i&&i.location?i.location.lat+", "+i.location.lon:"Unavailable";
 return '<div class="sheet"><div class="sheetHead"><b>Incident Control</b><button id="closePanel">✕</button></div>'+
 '<div class="incidentHero"><span>🚨</span><div><b>'+i.kind+'</b><small>Incident '+i.id+'</small></div><strong>STAGED</strong></div>'+
 '<div class="sheetCard"><span>📍</span><div><b>Location</b><small>'+loc+(i&&i.location?" • ±"+i.location.accuracy+" m":"")+'</small></div></div>'+
 '<div class="sheetCard"><span>📡</span><div><b>Escalation</b><small>Prepared locally. Verified emergency provider not connected.</small></div></div>'+
 '<div class="sheetCard"><span>👥</span><div><b>Trusted Contacts</b><small>'+trustedContacts.length+" configured locally"+'</small></div><button id="contactsBtn">OPEN</button></div>'+
 '<button id="clearIncident" class="cancel">CLOSE INCIDENT RECORD</button></div>';
}
function genericSheet(title,body){return '<div class="sheet"><div class="sheetHead"><b>'+title+'</b><button id="closePanel">✕</button></div>'+body+'</div>'}
function render(){
 const guardian=safety?"Monitoring journey conditions":"Monitoring paused";
 let sheet="";
 if(panel==="safety")sheet=safetySheet();
 if(panel==="incident"&&incident)sheet=incidentSheet();
 if(panel==="companion")sheet=genericSheet("AI Driver Companion",'<div class="sheetCard"><span>🎙️</span><div><b>Voice Companion</b><small>Hands-free assistance; provider adapter not connected</small></div><button id="voiceStart">OPEN</button></div><p class="sheetNote">Safety-gated voice interaction is designed to minimise driver distraction.</p>');
 if(panel==="vehicle")sheet=genericSheet("Vehicle Intelligence",'<div class="sheetCard"><span>🚗</span><div><b>Vehicle Status</b><small>Phone sensors available; OBD/telematics adapter not paired</small></div><button id="pairVehicle">PAIR</button></div><div class="sheetCard"><span>🔋</span><div><b>Diagnostics</b><small>Adapter interface ready</small></div></div>');
 if(panel==="fleet")sheet=genericSheet("Fleet Command",'<div class="sheetCard"><span>🏢</span><div><b>Fleet Mode</b><small>Driver and vehicle safety workspace</small></div><button id="fleetOpen">OPEN</button></div><div class="sheetCard"><span>📡</span><div><b>Secure Fleet / CIT</b><small>Enterprise security adapter not connected</small></div></div>');
 if(panel==="contacts")sheet=genericSheet("Trusted Contacts",'<div class="sheetCard"><span>👥</span><div><b>Local contact list</b><small>Contacts are stored on this device until a verified notification adapter is connected.</small></div></div><input id="contactName" class="textInput" placeholder="Contact name"><input id="contactPhone" class="textInput" placeholder="Phone number"><button id="addContact" class="confirm">ADD CONTACT</button><div class="events">'+(trustedContacts.map((c,i)=>'<div class="eventRow"><span>👤</span><div><b>'+c.name+'</b><small>'+c.phone+'</small></div><button data-contact="'+i+'" class="cancel">REMOVE</button></div>').join("")||'<div class="sheetNote">No trusted contacts configured.</div>')+'</div>');
 if(panel==="more")sheet=genericSheet("NAV Control Centre",'<div class="sheetCard"><span>⚙️</span><div><b>Settings</b><small>Navigation, safety and device preferences</small></div></div><div class="sheetCard"><span>🗺️</span><div><b>Maps / Routing</b><small>Provider-neutral adapter ready; live map provider not connected</small></div></div><div class="sheetCard"><span>🛡️</span><div><b>FORTRESS</b><small>Security adapter interface ready; not connected</small></div></div><div class="sheetCard"><span>🚑</span><div><b>Emergency Services</b><small>Dispatch adapter required before any live alert can be sent</small></div></div>');
 app.innerHTML='<div class="shell"><header><div class="brand"><span class="mark">I</span><div><b>IZAKHONO NAV</b><small>SAFETY INFRASTRUCTURE</small></div></div><div class="status"><i></i> '+(safety?"SAFE MODE ON":"SAFE MODE OFF")+'</div></header><main><section class="map"><div class="mapgrid"></div><div class="road r1"></div><div class="road r2"></div><div class="road r3"></div><div class="route"></div><div class="vehicle">▲</div><div class="destination"><span>●</span><div><b>Destination</b><small>Johannesburg CBD</small></div></div><div class="turn"><strong>350 m</strong><span>Keep left</span></div></section><section class="control"><div class="quickbar"><button id="quickSafety" class="quick safe">🛡️ <span>Safety Guardian</span></button><button id="quickEmergency" class="quick emergency">🚨 <span>EMERGENCY</span></button></div><div class="trip"><div><small>ARRIVAL</small><b>14:18</b></div><div><small>ETA</small><b>23 min</b></div><div><small>ROUTE</small><b>18.4 km</b></div></div><div class="guardian '+(safety?"active":"")+'"><span>🛡️</span><div><b>Driver Safety Guardian</b><small>'+guardian+'</small></div><button id="guardian">'+(safety?"ON":"OFF")+'</button></div><div class="actions"><button id="safe" class="action">🛡️<span>Safety</span></button><button id="voice" class="action">🎙️<span>Companion</span></button><button id="fleet" class="action">🚗<span>Vehicle</span></button><button id="help" class="action danger">🚨<span>Emergency</span></button></div><div class="panel"><div><small>JOURNEY INTELLIGENCE</small><b>Risk engine: '+(monitoring?"ACTIVE":"STANDBY")+'</b></div><div><small>CONNECTIVITY</small><b>Offline queue ready</b></div><div><small>FORTRESS</small><b>Adapter ready</b></div></div></section></main><footer><button class="'+(mode==="drive"?"selected":"")+'" data-mode="drive">🗺️<span>Navigate</span></button><button class="'+(mode==="safety"?"selected":"")+'" data-mode="safety">🛡️<span>Safety</span></button><button class="'+(mode==="fleet"?"selected":"")+'" data-mode="fleet">🏢<span>Fleet</span></button><button id="moreBtn">⚙️<span>More</span></button></footer>'+sheet+(emergency?'<div class="overlay"><div class="modal"><div class="alert">🚨</div><h2>Emergency Response</h2><p>Select the incident type. Nothing is sent to emergency services until a verified provider is connected.</p><button id="confirmEmergency" class="confirm">🚨 EMERGENCY</button><button id="confirmHijack" class="confirm">🕵️ HIJACK / COERCION</button><button id="cancel" class="cancel">CANCEL</button></div></div>':"")+'</div>';
 document.querySelector("#guardian")?.addEventListener("click",()=>{safety=!safety;render()});
 document.querySelector("#quickSafety")?.addEventListener("click",()=>{panel="safety";render()});
 document.querySelector("#quickEmergency")?.addEventListener("click",()=>{emergency=true;render()});
 document.querySelector("#safe")?.addEventListener("click",()=>{panel="safety";render()});
 document.querySelector("#voice")?.addEventListener("click",()=>{panel="companion";render()});
 document.querySelector("#fleet")?.addEventListener("click",()=>{panel="vehicle";render()});
 document.querySelector("#help")?.addEventListener("click",()=>{emergency=true;render()});
 document.querySelector("#moreBtn")?.addEventListener("click",()=>{panel="more";render()});
 document.querySelector("#closePanel")?.addEventListener("click",()=>{panel="";render()});
 document.querySelector("#sheetGuardian")?.addEventListener("click",()=>{safety=!safety;render()});
 document.querySelector("#startSensors")?.addEventListener("click",startSensors);
 document.querySelector("#testBrake")?.addEventListener("click",()=>recordEvent("Hard braking test","INFO","Local test event only; no emergency action triggered."));
 document.querySelector("#voiceStart")?.addEventListener("click",()=>alert("Voice Companion interface ready. Live provider integration is not connected."));
 document.querySelector("#pairVehicle")?.addEventListener("click",()=>alert("Vehicle adapter interface ready. Connect an approved OBD/telematics device."));
 document.querySelector("#fleetOpen")?.addEventListener("click",()=>alert("Fleet workspace is ready for authenticated fleet integration."));
 document.querySelector("#confirmEmergency")?.addEventListener("click",()=>createIncident("EMERGENCY"));
 document.querySelector("#confirmHijack")?.addEventListener("click",()=>createIncident("HIJACK"));
 document.querySelector("#cancel")?.addEventListener("click",()=>{emergency=false;render()});
 document.querySelector("#clearIncident")?.addEventListener("click",()=>{incident=null;panel="";render()});
 document.querySelector("#contactsBtn")?.addEventListener("click",()=>{panel="contacts";render()});
 document.querySelector("#addContact")?.addEventListener("click",()=>{const n=document.querySelector("#contactName")?.value.trim(),p=document.querySelector("#contactPhone")?.value.trim();if(n&&p){trustedContacts=[...trustedContacts,{name:n,phone:p}].slice(0,10);persist();render()}});
 document.querySelectorAll("[data-contact]").forEach(b=>b.addEventListener("click",()=>{trustedContacts.splice(+b.dataset.contact,1);persist();render()}));
 document.querySelectorAll("[data-mode]").forEach(x=>x.addEventListener("click",()=>{mode=x.dataset.mode;panel=mode==="safety"?"safety":mode==="fleet"?"fleet":"";render()}));
}
render();