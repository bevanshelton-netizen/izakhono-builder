import { createHash } from 'node:crypto';
import { authorizeRequest } from './fortress.mjs';
import { ingestOwnedRecords } from './search-index.mjs';

const sourceKinds = Object.freeze(['owned','approved_external','untrusted']);
const sourceStatuses = Object.freeze(['approved','pending','blocked']);
const defaultFreshnessSeconds = 86400;

function clean(value, limit = 240) { return String(value ?? '').trim().slice(0, limit); }
function canonicalizeUrl(value) {
  const raw = clean(value, 1000); if (!raw) return '';
  try { const url = new URL(raw); url.hash=''; url.hostname=url.hostname.toLowerCase(); if ((url.protocol==='https:'&&url.port==='443')||(url.protocol==='http:'&&url.port==='80')) url.port=''; return url.toString().replace(/\/$/,''); } catch { return raw; }
}
function fingerprint(record) { const value=[record.title,record.description,canonicalizeUrl(record.url),record.country,record.region,record.category].join('|').toLowerCase(); return createHash('sha256').update(value).digest('hex'); }

export function normalizeSource(input = {}) {
  const kind=sourceKinds.includes(input.kind)?input.kind:'untrusted'; const status=sourceStatuses.includes(input.status)?input.status:'pending';
  return {source_id:clean(input.source_id,160),name:clean(input.name,240),kind,uri:canonicalizeUrl(input.uri),status,approved:Boolean(input.approved)&&status==='approved'&&kind!=='untrusted',license:clean(input.license,160)||null,owner:clean(input.owner,160)||null,last_checked_at:input.last_checked_at||null,freshness_seconds:Number.isFinite(Number(input.freshness_seconds))?Math.max(60,Number(input.freshness_seconds)):defaultFreshnessSeconds};
}
export function sourceTrust(source = {}) { const normalized=normalizeSource(source); const trusted=normalized.approved&&['owned','approved_external'].includes(normalized.kind); return {trusted,reason:trusted?'approved_source':'source_not_approved',source:normalized}; }
export function normalizeDiscoveredRecord(record = {}, source = {}) {
  const normalizedSource=normalizeSource(source); const value={...record,id:clean(record.id||`${normalizedSource.source_id}:${fingerprint(record)}`,160),url:canonicalizeUrl(record.url),source:normalizedSource.source_id||clean(record.source||'owned',160),indexed_at:record.indexed_at||new Date().toISOString()};
  return {...value,fingerprint:fingerprint(value),provenance:{source_id:normalizedSource.source_id||null,source_kind:normalizedSource.kind,source_uri:normalizedSource.uri||null,license:normalizedSource.license,discovered_at:value.indexed_at}};
}
export function deduplicateRecords(records = []) {
  const seen=new Set(); const accepted=[]; const duplicates=[];
  for (const record of Array.isArray(records)?records:[]) {
    const canonicalUrl=canonicalizeUrl(record.url); const key=canonicalUrl?`url:${canonicalUrl.toLowerCase()}`:`fingerprint:${record.fingerprint||fingerprint(record)}`;
    if(seen.has(key)){duplicates.push({id:record.id||null,key,reason:canonicalUrl?'duplicate_url':'duplicate_fingerprint'});continue;}
    seen.add(key); accepted.push({...record,fingerprint:record.fingerprint||fingerprint(record)});
  }
  return {records:accepted,duplicates};
}
export function freshnessStatus(source = {}, now = new Date()) {
  const normalized=normalizeSource(source); if(!normalized.last_checked_at)return {fresh:false,reason:'never_checked',age_seconds:null,ttl_seconds:normalized.freshness_seconds};
  const checked=Date.parse(normalized.last_checked_at); if(!Number.isFinite(checked))return {fresh:false,reason:'invalid_last_checked_at',age_seconds:null,ttl_seconds:normalized.freshness_seconds};
  const age=Math.max(0,(now.getTime()-checked)/1000); return {fresh:age<=normalized.freshness_seconds,reason:age<=normalized.freshness_seconds?'within_ttl':'stale',age_seconds:Math.round(age),ttl_seconds:normalized.freshness_seconds};
}
export function prepareIngestion({principal,source={},records=[],correlationId,now=new Date()}={}) {
  const trust=sourceTrust(source); const fortress=authorizeRequest({principal,service:'search',action:'execute',resource:'service:search:index',correlationId});
  if(fortress.decision!=='allow')return {ok:false,reason:fortress.decision==='review'?'fortress_review_required':'fortress_authorization_denied',mode:'prepare_only',sideEffects:false,fortress};
  if(!trust.trusted)return {ok:false,reason:'source_not_approved',mode:'prepare_only',sideEffects:false,source:trust.source,fortress};
  const freshness=freshnessStatus(trust.source,now); const normalized=(Array.isArray(records)?records:[]).map(record=>normalizeDiscoveredRecord(record,trust.source)); const deduped=deduplicateRecords(normalized); const ingested=ingestOwnedRecords(deduped.records);
  return {ok:ingested.ok,mode:'prepare_only',sideEffects:false,source:trust.source,freshness,provenance:true,deduplication:{enabled:true,input:normalized.length,accepted:deduped.records.length,duplicates:deduped.duplicates.length},ingestion:ingested,fortress};
}
export function sourceKindsList(){return [...sourceKinds];}
export function sourceStatusesList(){return [...sourceStatuses];}
