/* IZAKHONO NAV — Hey NAV voice interaction runtime.
 * Browser-side speech interaction. No provider credentials are stored here.
 */
(function (root) {
  'use strict';

  const WAKE = /^\s*hey\s+nav\b[\s,.:!?-]*/i;
  const SpeechRecognition = root.SpeechRecognition || root.webkitSpeechRecognition;
  const state = { active:false, listening:false, sessionId:null, messages:[], recognition:null, wakeRecognition:null };

  function id(){ return 'nav-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  function emit(name,detail){ try{ root.dispatchEvent(new CustomEvent('izakhono-nav-voice',{detail:{name,...(detail||{})}})); }catch(_){} }

  function registerOwnedApp(){
    try{
      if(root.navigator && root.navigator.serviceWorker){ root.navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}); }
      if(root.document && !root.document.querySelector('link[rel="manifest"]')){
        const link=root.document.createElement('link'); link.rel='manifest'; link.href='./manifest.webmanifest'; root.document.head.appendChild(link);
      }
      if(root.document && !root.document.querySelector('link[rel="icon"]')){
        const icon=root.document.createElement('link'); icon.rel='icon'; icon.href='./icon.svg'; icon.type='image/svg+xml'; root.document.head.appendChild(icon);
      }
    }catch(_){}
  }

  function speak(text){
    if(!text || !root.speechSynthesis || !root.SpeechSynthesisUtterance)return;
    root.speechSynthesis.cancel(); const utterance=new root.SpeechSynthesisUtterance(String(text));
    utterance.rate=1.02; utterance.pitch=1; utterance.volume=1;
    utterance.onstart=()=>emit('speaking',{text});
    utterance.onend=()=>{ emit('speech_end'); if(state.active&&!state.listening&&SpeechRecognition) root.setTimeout(()=>startConversationRecognition(),180); };
    root.speechSynthesis.speak(utterance);
  }

  function localReply(text){
    const value=String(text||'').toLowerCase();
    if(/falling asleep|about to fall asleep|can't keep.*eyes|cannot keep.*eyes|not safe to drive|too tired to drive/.test(value)) return 'Please slow down safely and stop at the nearest safe place as soon as practical. I can stay with you while you decide where to stop.';
    if(/tired|sleepy|drowsy|fatigue|exhausted/.test(value)) return 'I hear you. If you are becoming too tired to drive safely, let’s find a safe place to stop.';
    return 'I’m here. The live voice service is not connected yet, but I can still help with basic NAV actions.';
  }

  async function ask(text){
    const user=String(text||'').trim(); if(!user){if(state.active&&SpeechRecognition)startConversationRecognition();return;}
    state.messages.push({role:'user',content:user}); state.messages=state.messages.slice(-12); emit('processing',{text:user});
    try{
      const response=await root.fetch('/api/nav/driver-companion',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({session_id:state.sessionId,messages:state.messages,context:{source:'hey_nav_voice',driver_initiated:true}})});
      const data=await response.json(); const reply=data&&data.text?String(data.text):localReply(user);
      state.messages.push({role:'assistant',content:reply}); state.messages=state.messages.slice(-12); emit('response',data||{ok:false,provider:'UNAVAILABLE',text:reply}); speak(reply);
    }catch(_){ const reply=localReply(user); state.messages.push({role:'assistant',content:reply}); emit('response',{ok:false,provider:'UNAVAILABLE',text:reply}); speak(reply); }
  }

  function stopRecognition(){ [state.recognition,state.wakeRecognition].forEach(r=>{try{if(r)r.stop();}catch(_){}}); state.recognition=null; state.wakeRecognition=null; state.listening=false; }
  function beginConversation(source){ if(state.wakeRecognition){try{state.wakeRecognition.stop();}catch(_){} state.wakeRecognition=null;} state.active=true; state.sessionId=state.sessionId||id(); emit('activated',{source:source||'tap',session_id:state.sessionId}); if(root.speechSynthesis&&root.SpeechSynthesisUtterance){speak('I’m listening.');}else if(SpeechRecognition){startConversationRecognition();}else{emit('recognition_error',{error:'speech_recognition_unavailable'});} }
  function startConversationRecognition(){
    if(!SpeechRecognition||state.listening||!state.active)return false; const r=new SpeechRecognition(); r.lang=root.navigator.language||'en-ZA'; r.continuous=false; r.interimResults=false; r.maxAlternatives=1;
    r.onstart=()=>{state.listening=true;emit('listening');}; r.onresult=event=>{const transcript=event.results&&event.results[0]&&event.results[0][0]&&event.results[0][0].transcript;state.listening=false;ask(transcript||'');}; r.onerror=event=>{state.listening=false;emit('recognition_error',{error:event.error||'unknown'});}; r.onend=()=>{state.listening=false;emit('recognition_end');}; state.recognition=r; try{r.start();return true;}catch(_){state.listening=false;return false;}
  }
  function activateByTap(){beginConversation('tap');}
  function startWakeListener(){
    if(!SpeechRecognition||state.active||state.wakeRecognition)return false; const r=new SpeechRecognition(); r.lang=root.navigator.language||'en-ZA'; r.continuous=true; r.interimResults=false; r.maxAlternatives=1;
    r.onresult=event=>{for(let i=event.resultIndex||0;i<event.results.length;i+=1){if(!event.results[i].isFinal)continue;const transcript=String(event.results[i][0]&&event.results[i][0].transcript||'').trim();const match=transcript.match(WAKE);if(match){const remainder=transcript.slice(match[0].length).trim();beginConversation('wake_phrase');if(remainder)ask(remainder);try{r.stop();}catch(_){}state.wakeRecognition=null;return;}}};
    r.onerror=()=>{state.wakeRecognition=null;emit('wake_listener_unavailable');}; r.onend=()=>{if(!state.active)state.wakeRecognition=null;}; state.wakeRecognition=r; try{r.start();emit('wake_listener_ready',{wake_phrase:'Hey NAV'});return true;}catch(_){state.wakeRecognition=null;return false;}
  }
  function endSession(){stopRecognition();state.active=false;state.sessionId=null;state.messages=[];if(root.speechSynthesis)root.speechSynthesis.cancel();emit('ended');startWakeListener();}

  const api={beginConversation,activateByTap,startWakeListener,startConversationRecognition,ask,endSession,state}; root.IZAKHONO_NAV_VOICE=api;
  registerOwnedApp(); emit('ready',{wake_phrase:'Hey NAV',tap_fallback:true,speech_available:!!SpeechRecognition});
})(typeof window!=='undefined'?window:globalThis);
