const app=document.querySelector("#root");
let mode="drive", safety=true, emergency=false, panel="", monitoring=false;
let lastSpeed=0, lastSpeedAt=0, safetyEvents=[];
try{safetyEvents=JSON.parse(localStorage.getItem("izakhono_nav_events")||"[]")}catch(e){safetyEvents=[]}
function saveEvents(){try{localStorage.setItem("izakhono_nav_events",JSON.stringify(safetyEvents))}catch(e){}}
function recordEvent(type,severity,detail){
 safetyEvents=[{id:Date.now(),type,severity,detail,at:new Date().toISOString()},...safetyEvents].slice(0,20);
 saveEvents(); render();
}
function startSensors(){
 if(monitoring)return;
 monitoring=true;
 if("geolocation" in navigator){
  navigator.geolocation.watchPosition(function(pos){
   const speed=Math.max(0,(pos.coords.speed||0)*3.6), now=Date.now();
   if(lastSpeedAt && now-lastSpeedAt>500){
    const dt=(now-lastSpeedAt)/1000, delta=(speed-lastSpeed)/dt;
    if(delta<-18 && safety)recordEvent("Hard braking candidate","HIGH","Estimated deceleration "+Math.round(Math.abs(delta)*10)/10+" m/s²");
    if(speed>120 && safety)recordEvent("Speed risk","HIGH","Estimated speed "+Math.round(speed)+" km/h");
   }
   lastSpeed=speed; lastSpeedAt=now;
  },function(){recordEvent("Location unavailable","INFO","GPS permission or signal unavailable; no emergency action is triggered.")},{enableHighAccuracy:true,maximumAge:2000,timeout:10000});
 }
 function motion(){
  window.addEventListener("devicemotion",function(e){
   const a=e.acceleration;
   if(!a||!safety)return;
   const magnitude=Math.sqrt((a.x||0)*(a.x||0)+(a.y||0)*(a.y||0)+(a.z||0)*(a.z||0));
   if(magnitude>25)recordEvent("Impact candidate","CRITICAL","Motion spike detected; verify before escalation.");
  });
 }
 if(typeof DeviceMotionEvent!=="undefined" && typeof DeviceMotionEvent.requestPermission==="function"){
  DeviceMotionEvent.requestPermission().then(function(p){if(p==="granted")motion()}).catch(function(){});
 }else{motion()}
 render();
}
function safetySheet(){
 const rows=safetyEvents.slice(0,5).map(function(e){
  const icon=e.severity==="CRITICAL"?"🔴":e.severity==="HIGH"?"🟠":"🔵";
  return '<div class="eventRow"><span>'+icon+'</span><div><b>'+e.type+'</b><small>'+e.detail+'</small></div></div>';
 }).join("")||'<div class="sheetNote">No safety events recorded.</div>';
 return '<div class="sheet"><div class="sheetHead"><b>Safety Centre</b><button id="closePanel">✕</button></div>'+
 '<div class="sheetCard"><span>🛡️</span><div><b>Driver Safety Guardian</b><small>'+(safety?"Monitoring journey conditions":"Monitoring paused")+'</small></div><button id="sheetGuardian">'+(safety?"ON":"OFF")+'</button></div>'+
 '<div class="sheetCard"><span>📡</span><div><b>Live Sensor Engine</b><small>'+(monitoring?"GPS/motion monitoring active":"Standby — sensors not active")+'</small></div><button id="startSensors">'+(monitoring?"ACTIVE":"START")+'</button></div>'+
 '<div class="sheetCard"><span>🧪</span><div><b>Safety Test</b><small>Local test only. No emergency service is contacted.</small></div><button id="testBrake">TEST</button></div>'+
 '<div class="events"><b>Recent safety events</b>'+rows+'</div>'+
 '<div class="sheetCard"><span>📴</span><div><b>Offline Event Queue</b><small>Events remain local until a verified sync adapter is connected.</small></div></div></div>';
}
function genericSheet(title,body){return '<div class="sheet"><div class="sheetHead"><b>'+title+'</b><button id="closePanel">✕</button></div>'+body+'</div>'}
function render(){
 const guardianState=safety?"Monitoring journey conditions":"Monitoring paused";
 let sheet="";
 if(panel==="safety")sheet=safetySheet();
 if(panel==="companion")sheet=genericSheet("AI Driver Companion",'<div class="sheetCard"><span>🎙️</span><div><b>Voice Companion</b><small>Hands-free driving assistance</small></div><button id="voiceStart">OPEN</button></div><p class="sheetNote">Voice actions will be safety-gated while driving.</p>');
 if(panel==="vehicle")sheet=genericSheet("Vehicle Intelligence",'<div class="sheetCard"><span>🚗</span><div><b>Vehicle Status</b><small>Phone-sensor and OBD/telematics adapters</small></div></div><div class="sheetCard"><span>🔋</span><div><b>Diagnostics</b><small>Connection not yet paired</small></div><button id="pairVehicle">PAIR</button></div>');
 if(panel==="fleet")sheet=genericSheet("Fleet Command",'<div class="sheetCard"><span>🏢</span><div><b>Fleet Mode</b><small>Vehicle monitoring and driver safety workspace</small></div></div><div class="sheetCard"><span>📡</span><div><b>Secure Fleet</b><small>CIT and enterprise security adapters are not connected yet</small></div></div>');
 if(panel==="more")sheet=genericSheet("NAV Control Centre",'<div class="sheetCard"><span>⚙️</span><div><b>Settings</b><small>Navigation, safety and device preferences</small></div><button id="settingsBtn">OPEN</button></div><div class="sheetCard"><span>🛡️</span><div><b>FORTRESS</b><small>Security integration status</small></div><b class="pending">ADAPTER READY</b></div>');
 app.innerHTML='<div class="shell"><header><div class="brand"><span class="mark">I</span><div><b>IZAKHONO NAV</b><small>SAFETY INFRASTRUCTURE</small></div></div><div class="status"><i></i> '+(safety?"SAFE MODE ON":"SAFE MODE OFF")+'</div></header><main><section class="map"><div class="mapgrid"></div><div class="road r1"></div><div class="road r2"></div><div class="road r3"></div><div class="route"></div><div class="vehicle">▲</div><div class="destination"><span>●</span><div><b>Destination</b><small>Johannesburg CBD</small></div></div><div class="turn"><strong>350 m</strong><span>Keep left</span></div></section><section class="control"><div class="quickbar"><button id="quickSafety" class="quick safe">🛡️ <span>Safety Guardian</span></button><button id="quickEmergency" class="quick emergency">🚨 <span>EMERGENCY</span></button></div><div class="trip"><div><small>ARRIVAL</small><b>14:18</b></div><div><small>ETA</small><b>23 min</b></div><div><small>ROUTE</small><b>18.4 km</b></div></div><div class="guardian '+(safety?"active":"")+'"><span>🛡️</span><div><b>Driver Safety Guardian</b><small>'+guardianState+'</small></div><button id="guardian">'+(safety?"ON":"OFF")+'</button></div><div class="actions"><button id="safe" class="action">🛡️<span>Safety</span></button><button id="voice" class="action">🎙️<span>Companion</span></button><button id="fleet" class="action">🚗<span>Vehicle</span></button><button id="help" class="action danger">🚨<span>Emergency</span></button></div><div class="panel"><div><small>JOURNEY INTELLIGENCE</small><b>Risk engine: '+(monitoring?"ACTIVE":"STANDBY")+'</b></div><div><small>CONNECTIVITY</small><b>Offline queue ready</b></div><div><small>FORTRESS</small><b>Adapter ready</b></div></div></section></main><footer><button class="'+(mode==="drive"?"selected":"")+'" data-mode="drive">🗺️<span>Navigate</span></button><button class="'+(mode==="safety"?"selected":"")+'" data-mode="safety">🛡️<span>Safety</span></button><button class="'+(mode==="fleet"?"selected":"")+'" data-mode="fleet">🏢<span>Fleet</span></button><button id="moreBtn">⚙️<span>More</span></button></footer>'+sheet+(emergency?'<div class="overlay"><div class="modal"><div class="alert">🚨</div><h2>Emergency Response</h2><p>No call or alert is sent until you confirm.</p><button id="confirm" class="confirm">CONFIRM EMERGENCY</button><button id="cancel" class="cancel">CANCEL</button></div></div>':"")+'</div>';
 document.querySelector("#guardian")?.addEventListener("click",function(){safety=!safety;render()});
 document.querySelector("#quickSafety")?.addEventListener("click",function(){panel="safety";render()});
 document.querySelector("#quickEmergency")?.addEventListener("click",function(){emergency=true;render()});
 document.querySelector("#safe")?.addEventListener("click",function(){panel="safety";render()});
 document.querySelector("#voice")?.addEventListener("click",function(){panel="companion";render()});
 document.querySelector("#fleet")?.addEventListener("click",function(){panel="vehicle";render()});
 document.querySelector("#help")?.addEventListener("click",function(){emergency=true;render()});
 document.querySelector("#moreBtn")?.addEventListener("click",function(){panel="more";render()});
 document.querySelector("#closePanel")?.addEventListener("click",function(){panel="";render()});
 document.querySelector("#sheetGuardian")?.addEventListener("click",function(){safety=!safety;render()});
 document.querySelector("#startSensors")?.addEventListener("click",startSensors);
 document.querySelector("#testBrake")?.addEventListener("click",function(){recordEvent("Hard braking test","INFO","Local test event only; no emergency action triggered.")});
 document.querySelector("#voiceStart")?.addEventListener("click",function(){alert("Voice Companion interface ready. Provider integration is not connected.")});
 document.querySelector("#pairVehicle")?.addEventListener("click",function(){alert("Vehicle pairing interface ready. Connect an approved OBD or telematics adapter.")});
 document.querySelector("#settingsBtn")?.addEventListener("click",function(){alert("NAV settings workspace is ready for configuration modules.")});
 document.querySelector("#cancel")?.addEventListener("click",function(){emergency=false;render()});
 document.querySelector("#confirm")?.addEventListener("click",function(){recordEvent("Emergency confirmation","CRITICAL","Emergency workflow staged locally. No emergency service was contacted.");emergency=false;render()});
 document.querySelectorAll("[data-mode]").forEach(function(x){x.addEventListener("click",function(){mode=x.dataset.mode;panel=mode==="safety"?"safety":mode==="fleet"?"fleet":"";render()})});
}
render();