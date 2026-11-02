(() => {
  const CONFIG = {
    endpoint: '/api/nav/fatigue/voice',
    timeoutMs: 12000,
    maxTranscriptChars: 1200
  };

  const state = {
    mode: 'UNAVAILABLE',
    provider: 'UNCONNECTED',
    busy: false,
    lastResponse: null,
    error: null,
    outbox: []
  };

  function sanitizeText(value) {
    return String(value || '').trim().slice(0, CONFIG.maxTranscriptChars);
  }

  function safeContext(context) {
    if (!context || typeof context !== 'object') return {};
    return {
      journeyId: context.journeyId || null,
      vehicleState: context.vehicleState || null,
      safetyState: context.safetyState || 'NORMAL',
      connectivity: context.connectivity || 'UNKNOWN'
    };
  }

  function fallbackReply(transcript) {
    const text = transcript.toLowerCase();
    if (/falling asleep|can't keep my eyes open|cannot keep my eyes open|about to sleep|too tired/.test(text)) {
      return {
        replyText: 'Thank you for telling me. Please slow down safely and stop at the next safe place to rest. I can help you with the safety process.',
        safetyPosture: 'SAFETY_ESCALATION',
        nextStep: 'SAFE_STOP_RECOMMENDED',
        confidence: 'CONVERSATION_REPORTED'
      };
    }
    if (/tired|fatigue|sleepy|exhausted/.test(text)) {
      return {
        replyText: 'I hear you. Let us keep this simple. If you feel your driving is becoming unsafe, please take a safe break rather than pushing through.',
        safetyPosture: 'WATCH',
        nextStep: 'CHECK_DRIVER_STATE',
        confidence: 'CONVERSATION_REPORTED'
      };
    }
    return {
      replyText: 'I am listening. Tell me what you need, and I will keep the conversation brief and focused on your journey.',
      safetyPosture: 'NORMAL',
      nextStep: 'CONTINUE_CONVERSATION',
      confidence: 'LOCAL_FALLBACK'
    };
  }

  async function request(payload) {
    const transcript = sanitizeText(payload && payload.transcript);
    if (!transcript) throw new Error('Transcript is required');

    state.busy = true;
    state.error = null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.timeoutMs);

    try {
      const response = await fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          sessionId: payload.sessionId || null,
          locale: payload.locale || navigator.language || 'en-ZA',
          transcript,
          context: safeContext(payload.context),
          safetyState: payload.safetyState || 'NORMAL'
        })
      });

      if (!response.ok) throw new Error(`Provider request failed: ${response.status}`);
      const data = await response.json();
      if (!data || typeof data.replyText !== 'string') throw new Error('Invalid provider response');

      state.mode = 'LIVE';
      state.provider = data.provider || 'AUTHENTICATED_PROVIDER';
      state.lastResponse = data;
      return data;
    } catch (error) {
      state.mode = 'UNAVAILABLE';
      state.provider = 'LOCAL_FALLBACK';
      state.error = error && error.message ? error.message : 'Provider unavailable';
      const fallback = fallbackReply(transcript);
      state.lastResponse = fallback;
      return { ...fallback, providerStatus: 'UNAVAILABLE', provider: 'LOCAL_FALLBACK' };
    } finally {
      clearTimeout(timer);
      state.busy = false;
    }
  }

  function queue(payload) {
    const item = {
      id: `fatigue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: payload.sessionId || null,
      event: 'VOICE_INTERACTION_PENDING',
      safetyState: payload.safetyState || 'NORMAL',
      createdAt: new Date().toISOString()
    };
    state.outbox.push(item);
    try { localStorage.setItem('izakhono_nav_fatigue_outbox', JSON.stringify(state.outbox)); } catch (_) {}
    return item;
  }

  function loadOutbox() {
    try { state.outbox = JSON.parse(localStorage.getItem('izakhono_nav_fatigue_outbox') || '[]'); } catch (_) { state.outbox = []; }
    return state.outbox;
  }

  window.IZAKHONO_NAV_FATIGUE_AI = {
    state,
    request,
    queue,
    loadOutbox,
    fallbackReply
  };
})();
