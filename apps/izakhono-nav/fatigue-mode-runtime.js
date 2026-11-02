/* IZAKHONO NAV — Fatigue Mode Driver-Initiated Voice Runtime v0.1
 * Quiet by default. Driver activation is required before voice interaction.
 * No fabricated fatigue detection, emergency dispatch, police notification, or vehicle control.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'izakhono-nav-fatigue-mode-v1';
  const EVENTS_KEY = 'izakhono-nav-fatigue-events-v1';
  const API = '/api/nav/fatigue-mode';
  const STATES = Object.freeze({ READY:'READY', DRIVER_ACTIVATED:'DRIVER_ACTIVATED', LISTENING:'LISTENING', CONVERSING:'CONVERSING', SAFETY_ESCALATION:'SAFETY_ESCALATION' });

  const state = {
    mode: 'UNAVAILABLE',
    state: STATES.READY,
    sessionId: null,
    transcript: [],
    outbox: [],
    audit: [],
    lastError: null,
    voice: { available: false, speaking: false, listening: false },
    provider: { type: 'browser', connected: false }
  };

  function now() { return new Date().toISOString(); }
  function id(prefix) { return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function audit(type, data) {
    const event = { id:id('fatigue'), type, at:now(), sessionId:state.sessionId, data:data || {} };
    state.audit.push(event); if (state.audit.length > 100) state.audit.shift(); persist(); return event;
  }
  function queue(type, payload) {
    state.outbox.push({ id:id('outbox'), type, createdAt:now(), payload });
    if (state.outbox.length > 100) state.outbox.shift(); persist();
  }
  async function post(path, payload) {
    try {
      const r = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      state.mode = 'LIVE'; state.lastError = null; return await r.json().catch(() => ({}));
    } catch (e) {
      state.mode = 'UNAVAILABLE'; state.lastError = e.message; queue('api_event', { path, payload }); persist(); return null;
    }
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.94; utterance.pitch = 1;
    utterance.onstart = () => { state.voice.speaking = true; persist(); };
    utterance.onend = () => { state.voice.speaking = false; persist(); };
    window.speechSynthesis.speak(utterance);
    return true;
  }
  function beginListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { state.voice.available = false; state.voice.listening = false; persist(); return false; }
    const recognition = new SR();
    recognition.lang = navigator.language || 'en-ZA';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { state.voice.listening = true; state.state = STATES.LISTENING; persist(); render(); };
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.trim();
      state.voice.listening = false;
      state.state = STATES.CONVERSING;
      state.transcript.push({ speaker:'driver', text, at:now() });
      audit('driver_voice_input', { text });
      post(API + '/events', { type:'driver_voice_input', sessionId:state.sessionId, text, at:now() });
      handleDriverSpeech(text);
      render();
    };
    recognition.onerror = (event) => { state.voice.listening = false; state.lastError = event.error || 'speech recognition error'; persist(); render(); };
    recognition.onend = () => { state.voice.listening = false; persist(); render(); };
    state.voice.available = true;
    recognition.start();
    return true;
  }
  function handleDriverSpeech(text) {
    const lower = text.toLowerCase();
    const urgent = /(falling asleep|fall asleep|can't keep my eyes open|cannot keep my eyes open|i need help|help me|hijack|hijacked|in danger|emergency)/i.test(lower);
    const stop = /(stop talking|end conversation|goodbye|cancel|i'm fine|im fine|no thanks)/i.test(lower);
    let reply = 'I’m listening. Tell me what you need.';
    if (urgent) {
      state.state = STATES.SAFETY_ESCALATION;
      reply = 'I hear you. Please keep the vehicle safely under control. If you can, move to a safe place to stop. I can open the safety workflow.';
      audit('safety_escalation_requested', { reason:'driver_reported_safety_context' });
      post(API + '/escalate', { sessionId:state.sessionId, reason:'driver_reported_safety_context', at:now() });
    } else if (stop) {
      reply = 'Understood. I’ll stay quiet.';
      endSession('driver_stopped_conversation', false);
      return;
    } else if (/tired|fatigue|sleepy|sleep/.test(lower)) {
      reply = 'Thanks for telling me. If you feel unsafe to continue, the safest option is to stop somewhere safe and rest. Would you like to keep talking?';
    }
    state.transcript.push({ speaker:'nav', text:reply, at:now() });
    audit('nav_voice_response', { text:reply });
    speak(reply);
    persist();
  }
  function activate() {
    if (state.state !== STATES.READY) return state;
    state.sessionId = id('fatigue-session');
    state.state = STATES.DRIVER_ACTIVATED;
    state.transcript = [];
    audit('driver_activated', {});
    persist();
    speak("I'm listening.");
    setTimeout(() => beginListening(), 450);
    render();
    return state;
  }
  function endSession(reason, speakGoodbye) {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    state.voice.listening = false;
    state.voice.speaking = false;
    audit('session_ended', { reason });
    if (speakGoodbye) speak('Understood. I’ll stay quiet.');
    state.state = STATES.READY;
    state.sessionId = null;
    persist(); render();
  }
  function flush() {
    if (!navigator.onLine || !state.outbox.length) return Promise.resolve();
    const pending = state.outbox.slice();
    return Promise.all(pending.map(item => fetch(API + '/events', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item.payload)}).then(r => { if(!r.ok) throw new Error('sync failed'); return item.id; }).catch(()=>null)))
      .then(done => { const set = new Set(done.filter(Boolean)); state.outbox = state.outbox.filter(x => !set.has(x.id)); state.mode = state.outbox.length ? 'UNAVAILABLE' : 'LIVE'; persist(); render(); });
  }
  function getState() { return JSON.parse(JSON.stringify(state)); }
  function render() {
    const root = document.querySelector('[data-fatigue-mode]'); if (!root) return;
    const active = state.state !== STATES.READY;
    root.querySelectorAll('[data-fatigue-activate]').forEach(b => b.disabled = active);
    root.querySelectorAll('[data-fatigue-stop]').forEach(b => b.disabled = !active);
    const status = root.querySelector('[data-fatigue-status]'); if (status) status.textContent = active ? (state.voice.listening ? 'Listening…' : state.state === STATES.SAFETY_ESCALATION ? 'Safety workflow' : 'Conversation active') : 'Ready';
    const mode = root.querySelector('[data-fatigue-mode-state]'); if (mode) mode.textContent = state.mode;
    const log = root.querySelector('[data-fatigue-transcript]'); if (log) log.innerHTML = state.transcript.slice(-8).map(x => '<div><strong>' + escapeHtml(x.speaker === 'nav' ? 'NAV' : 'DRIVER') + ':</strong> ' + escapeHtml(x.text) + '</div>').join('');
  }
  function escapeHtml(v) { return String(v).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
  function mount() {
    try { Object.assign(state, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch (_) {}
    if (!state.state) state.state = STATES.READY;
    if (!Array.isArray(state.transcript)) state.transcript=[];
    if (!Array.isArray(state.outbox)) state.outbox=[];
    if (!Array.isArray(state.audit)) state.audit=[];
    window.addEventListener('online', flush);
    document.addEventListener('click', e => {
      if (e.target.closest('[data-fatigue-activate]')) activate();
      if (e.target.closest('[data-fatigue-stop]')) endSession('driver_stopped', true);
    });
    render();
  }

  window.SHELTON_NAV_FATIGUE = Object.freeze({ STATES, state:getState, activate, stop:()=>endSession('driver_stopped', true), flush, speak, listen:beginListening });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
