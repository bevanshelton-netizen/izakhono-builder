(() => {
  const API = '/api/freight/revenue-intelligence';
  const EVENTS = '/api/freight/revenue-intelligence/events';
  const state = { mode:'UNAVAILABLE', accounts:[], outbox:[], audit:[], lastSync:null, error:null };

  const verified = v => v && v.verified === true && v.demo !== true;
  const num = v => Number.isFinite(Number(v)) ? Number(v) : null;

  function scoreAccount(account, signals = {}) {
    const s = Object.values(signals).filter(verified);
    if (!s.length) return { band:'UNAVAILABLE', score:null, reasons:['No verified commercial signals available'], verifiedSignals:0 };
    let score = 50, reasons = [];
    const revenue = num(signals.revenue_per_customer?.value);
    const margin = num(signals.customer_margin?.value);
    const repeat = num(signals.repeat_job_rate?.value);
    const outstanding = num(signals.outstanding_value?.value);
    if (revenue !== null && revenue > 0) { score += 10; reasons.push('Verified revenue activity'); }
    if (margin !== null && margin > 0) { score += 10; reasons.push('Positive verified margin'); }
    if (repeat !== null && repeat >= 0.5) { score += 10; reasons.push('Strong verified repeat-job rate'); }
    if (outstanding !== null && outstanding > 0) { score -= 10; reasons.push('Verified outstanding value requires review'); }
    if (score >= 70) return {band:'GROWING',score,reasons,verifiedSignals:s.length};
    if (score >= 55) return {band:'STABLE',score,reasons,verifiedSignals:s.length};
    if (score >= 40) return {band:'WATCH',score,reasons,verifiedSignals:s.length};
    return {band:'REVIEW',score,reasons,verifiedSignals:s.length};
  }

  async function sync() {
    try {
      const r = await fetch(API, {headers:{accept:'application/json'}});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      state.accounts = Array.isArray(data.accounts) ? data.accounts : [];
      state.mode = 'LIVE'; state.lastSync = new Date().toISOString(); state.error = null;
      return state;
    } catch (e) { state.mode = 'UNAVAILABLE'; state.error = e.message; return state; }
  }

  function evaluate(account, signals) {
    const result = scoreAccount(account, signals);
    const record = {...account, ...result, evaluatedAt:new Date().toISOString()};
    state.accounts = state.accounts.filter(a => a.id !== account.id).concat(record);
    state.audit.push({action:'evaluate', accountId:account.id, at:record.evaluatedAt, result});
    return record;
  }

  function queue(event) {
    state.outbox.push({...event, queuedAt:new Date().toISOString()});
    return state.outbox.length;
  }

  async function flush() {
    while (state.outbox.length) {
      const event = state.outbox[0];
      try {
        const r = await fetch(EVENTS,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event)});
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        state.outbox.shift();
      } catch (e) { state.error=e.message; break; }
    }
    return state.outbox.length;
  }

  function loadDemo() {
    state.mode='DEMO';
    state.accounts=[
      {id:'DEMO-ACCOUNT-01',name:'Demo Account A',currency:'ZAR',revenue:{value:420000,verified:false,demo:true},band:'UNAVAILABLE'},
      {id:'DEMO-ACCOUNT-02',name:'Demo Account B',currency:'ZAR',revenue:{value:185000,verified:false,demo:true},band:'UNAVAILABLE'}
    ];
    return state;
  }

  window.SHELTON_FREIGHT_REVENUE = {state,sync,evaluate,scoreAccount,queue,flush,loadDemo};
})();