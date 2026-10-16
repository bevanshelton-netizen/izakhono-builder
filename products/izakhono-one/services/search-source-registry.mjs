import { normalizeDiscoverySource } from './search-discovery.mjs';

const maxSources = 1000;

function normalizeInterval(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(300, Math.min(seconds, 2592000)) : 86400;
}

export function normalizeSourceRegistration(input = {}) {
  const source = normalizeDiscoverySource(input);
  return { ...source, schedule_seconds:normalizeInterval(input.schedule_seconds), priority:Number.isFinite(Number(input.priority)) ? Math.max(0, Math.min(Number(input.priority), 100)) : 50, next_refresh_at:input.next_refresh_at || null, last_refresh_at:input.last_refresh_at || null, refresh_state:['idle','due','running','blocked','failed'].includes(input.refresh_state) ? input.refresh_state : 'idle' };
}

export function registerSources(sources = []) {
  if (!Array.isArray(sources)) return { ok:false, records:[], rejected:1, errors:['sources_array_required'] };
  const records=[]; const errors=[];
  for (const source of sources.slice(0,maxSources)) {
    const value=normalizeSourceRegistration(source);
    if (!value.source_id) errors.push({source_id:null,reason:'source_id_required'});
    else if (!value.approved) errors.push({source_id:value.source_id,reason:'source_not_approved'});
    else records.push(value);
  }
  return {ok:errors.length===0,records,rejected:errors.length,errors,maxSources};
}

export function dueSources(sources = [], now = new Date()) {
  const timestamp=now.getTime();
  return sources.filter(source => {
    if (!source?.approved || !source?.enabled) return false;
    if (source.refresh_state==='running' || source.refresh_state==='blocked') return false;
    if (!source.next_refresh_at) return true;
    const next=Date.parse(source.next_refresh_at);
    return !Number.isFinite(next) || next<=timestamp;
  }).sort((a,b)=>(b.priority||0)-(a.priority||0));
}

export function scheduleNextRefresh(source, now = new Date()) {
  const value=normalizeSourceRegistration(source);
  return {...value,refresh_state:'idle',next_refresh_at:new Date(now.getTime()+value.schedule_seconds*1000).toISOString()};
}

export function refreshPlan(sources = [], now = new Date()) {
  const due=dueSources(sources,now);
  return {generated_at:now.toISOString(),due_count:due.length,sources:due.map((source,position)=>({source_id:source.source_id,priority:source.priority,position:position+1,schedule_seconds:source.schedule_seconds}))};
}
