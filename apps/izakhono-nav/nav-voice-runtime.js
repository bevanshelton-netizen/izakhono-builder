/* IZAKHONO NAV — Voice-first interaction runtime v0.1
 * Primary: "Hey NAV" wake phrase. Fallback: tap #voice.
 * Browser baseline uses SpeechRecognition where available. AI replies use the
 * existing /api/driver-companion/chat contract when a backend is available.
 * No always-on cloud audio, no automatic microphone start, no vehicle control.
 */
(function(){
  'use strict';
  const button=document.getElementById('voice');
  if(!button)return;
  const toast=window.toast||function(t){const e=document.getElementById('toast');if(e){e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}};
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const synth=window.speechSynthesis;
  let recognition=null, listening=false, session=false;
  let wakeBuffer='';
  const WAKE=/\b(?:hey|okay|ok)\s+nav\b/i;
  const api=window.IZAKHONO_DRIVER_COMPANION_ENDPOINT||'/api/driver-companion/chat';

  function speak(text){
    if(!text||!synth)return;
    synth.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.rate=1.0; u.pitch=1.0; u.volume=1.0;
    synth.speak(u);
  }
  function setActive(on){
    button.classList.toggle('voice-active',on);
    button.setAttribute('aria-label',on?'NAV is listening':'Driver companion');
    button.textContent=on?'●':'◉';
  }
  function startSession(source){
    if(session)return;
    session=true; wakeBuffer=''; setActive(true);
    toast('NAV: I’m listening.');
    speak('I’m listening.');
    if(SpeechRecognition) beginRecognition(true);
    else toast('Voice recognition is unavailable. Tap the voice signal to use your device controls.');
    window.dispatchEvent(new CustomEvent('izakhono-nav-voice-start',{detail:{source}}));
  }
  function stopSession(){
    session=false; listening=false; wakeBuffer='';
    if(recognition){try{recognition.stop()}catch(e){}}
    setActive(false);
    window.dispatchEvent(new CustomEvent('izakhono-nav-voice-stop'));
  }
  function beginRecognition(activeConversation){
    if(!SpeechRecognition)return;
    if(recognition){try{recognition.abort()}catch(e){}}
    recognition=new SpeechRecognition();
    recognition.lang=navigator.language||'en-ZA';
    recognition.continuous=false;
    recognition.interimResults=true;
    recognition.maxAlternatives=3;
    listening=true;
    recognition.onresult=function(ev){
      let finalText=''; let interim='';
      for(let i=ev.resultIndex;i<ev.results.length;i++){
        const text=ev.results[i][0].transcript.trim();
        if(ev.results[i].isFinal) finalText+=' '+text; else interim+=' '+text;
      }
      const text=(finalText||interim).trim();
      if(!text)return;
      if(!session){
        wakeBuffer=(wakeBuffer+' '+text).trim().slice(-160);
        if(WAKE.test(wakeBuffer)){
          startSession('wake_phrase');
        }
        return;
      }
      if(finalText) handleUser(finalText.trim());
    };
    recognition.onerror=function(ev){
      listening=false;
      if(ev.error==='not-allowed'||ev.error==='service-not-allowed'){
        toast('Microphone permission is unavailable. Tap the NAV signal when ready.');
      }
    };
    recognition.onend=function(){
      listening=false;
      if(session){
        // Conversation remains driver-controlled; listen again only while the session is active.
        setTimeout(()=>{if(session&&!listening)beginRecognition(true)},250);
      }
    };
    try{recognition.start()}catch(e){listening=false}
  }
  async function handleUser(text){
    window.dispatchEvent(new CustomEvent('izakhono-nav-voice-input',{detail:{text}}));
    if(/^\s*(stop|cancel|end|goodbye)\s*$/i.test(text)){
      speak('Okay. I’m here when you need me.'); stopSession(); return;
    }
    try{
      const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,context:{source:'hey-nav',session:'driver_initiated'}})});
      const data=await r.json().catch(()=>({}));
      const reply=data.text||data.response;
      if(r.ok&&reply){
        speak(reply);
        window.dispatchEvent(new CustomEvent('izakhono-nav-voice-response',{detail:data}));
      }else{
        localResponse(text,data);
      }
    }catch(e){localResponse(text,{provider:'unavailable'})}
  }
  function localResponse(text,data){
    const t=text.toLowerCase();
    if(/falling asleep|can't keep.*eyes|cannot keep.*eyes|about to sleep|very sleepy/.test(t)){
      speak('Please pull over somewhere safe as soon as practical. I can help you find a safe stopping place.');
    }else if(/tired|sleepy|fatigue|exhausted|drowsy/.test(t)){
      speak('I hear you. Let’s find a safe place to stop and take a break.');
    }else if(/stop talking|be quiet|stop/.test(t)){
      speak('Okay. I’ll stay quiet.'); stopSession();
    }else{
      speak('I’m here. I can help with your journey, safety, or destination.');
    }
    window.dispatchEvent(new CustomEvent('izakhono-nav-voice-fallback',{detail:{text,safety_state:data.safety_state||'UNKNOWN'}}));
  }

  // Fallback tap is always available and remains the explicit user action.
  button.addEventListener('click',function(){
    if(session){stopSession();return;}
    startSession('tap_fallback');
  });

  // Wake-word detection is only armed after explicit user permission.
  // The browser may require a user gesture before speech recognition can start.
  window.IZAKHONONavVoice={start:startSession,stop:stopSession,isActive:()=>session};
  button.insertAdjacentHTML('afterend','<span id="navVoiceStatus" class="sr-only" aria-live="polite"></span>');
  const sr=document.getElementById('navVoiceStatus');
  const announce=(t)=>{if(sr)sr.textContent=t};
  window.addEventListener('izakhono-nav-voice-start',()=>announce('NAV is listening'));
  window.addEventListener('izakhono-nav-voice-stop',()=>announce('NAV voice session ended'));

  // Best-effort wake phrase arming. Some browsers prohibit background microphone
  // access; in those cases the tap fallback remains fully functional.
  function armWake(){
    if(!SpeechRecognition||session||listening)return;
    try{
      recognition=new SpeechRecognition();
      recognition.lang=navigator.language||'en-ZA';
      recognition.continuous=true;
      recognition.interimResults=true;
      recognition.onresult=function(ev){
        for(let i=ev.resultIndex;i<ev.results.length;i++){
          const text=ev.results[i][0].transcript.trim();
          wakeBuffer=(wakeBuffer+' '+text).trim().slice(-160);
          if(WAKE.test(wakeBuffer)){
            try{recognition.stop()}catch(e){}
            startSession('wake_phrase'); return;
          }
        }
      };
      recognition.onerror=function(){listening=false};
      recognition.onend=function(){listening=false;if(!session)setTimeout(armWake,800)};
      recognition.start(); listening=true;
    }catch(e){listening=false}
  }
  // Do not force microphone permission. Arm after the first user gesture.
  document.addEventListener('click',function once(){document.removeEventListener('click',once);armWake()},{once:true});
})();