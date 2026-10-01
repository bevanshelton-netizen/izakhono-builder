const video=document.getElementById('screen'),state=document.getElementById('state'),display=document.getElementById('display');
let pc=null,ws=null,session=null;
const setState=x=>state.textContent=x;
async function connect(){
 setState('Authorizing…');
 const r=await fetch('/api/graphics/session',{method:'POST',headers:{'x-commander-admin':sessionStorage.getItem('cs')||''},body:'{}'});
 if(!r.ok){setState('Authorization failed');return}
 session=await r.json();
 ws=new WebSocket(session.websocketUrl);
 pc=new RTCPeerConnection({iceServers:session.iceServers||[]});
 pc.ontrack=e=>{video.srcObject=e.streams[0]};
 pc.onicecandidate=e=>{if(e.candidate)ws.send(JSON.stringify({type:'ice',candidate:JSON.stringify(e.candidate)}))};
 ws.onopen=()=>setState('Negotiating…');
 ws.onmessage=async e=>{
  const m=JSON.parse(e.data);
  if(m.type==='offer'){await pc.setRemoteDescription(m);const a=await pc.createAnswer();await pc.setLocalDescription(a);ws.send(JSON.stringify({type:'answer',sdp:a.sdp}))}
  if(m.type==='display_list'){display.innerHTML=m.displays.map(d=>'<option value="'+d.id+'">'+d.name+' ('+d.width+'×'+d.height+')</option>').join('')}
  if(m.type==='ready')setState('Connected');
 };
 video.addEventListener('pointermove',e=>sendInput({type:'pointer_move',x:e.offsetX/video.clientWidth,y:e.offsetY/video.clientHeight}));
 video.addEventListener('pointerdown',e=>{e.preventDefault();sendInput({type:'mouse_button',button:e.button===2?'right':e.button===1?'middle':'left',down:true})});
 video.addEventListener('pointerup',e=>{e.preventDefault();sendInput({type:'mouse_button',button:e.button===2?'right':e.button===1?'middle':'left',down:false})});
 video.addEventListener('wheel',e=>{e.preventDefault();sendInput({type:'wheel',deltaX:e.deltaX,deltaY:e.deltaY})},{passive:false});
 video.addEventListener('contextmenu',e=>e.preventDefault());
 window.addEventListener('keydown',e=>{if(document.activeElement===video)sendInput({type:'key',code:e.code,down:true})});
 window.addEventListener('keyup',e=>{if(document.activeElement===video)sendInput({type:'key',code:e.code,down:false})});
}
function sendInput(event){if(ws?.readyState===1)ws.send(JSON.stringify({type:'input',event}))}
document.getElementById('connect').onclick=connect;
document.getElementById('stop').onclick=()=>{ws?.send(JSON.stringify({type:'close'}));pc?.close();ws?.close();setState('Disconnected')};
