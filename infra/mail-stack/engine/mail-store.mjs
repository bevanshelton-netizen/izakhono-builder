/**
 * IZAKHONO MAIL STORE — persistence boundary for messages, events and idempotency.
 */

export class MailStore {
  constructor({ adapter = new MemoryMailStoreAdapter(), clock = () => new Date().toISOString() } = {}) { this.adapter = adapter; this.clock = clock; }
  async putMessage(message) { if (!message?.message_id) throw new Error("message_id is required"); return this.adapter.putMessage({ ...message, updated_at: message.updated_at || this.clock() }); }
  async getMessage(messageId, { tenantId } = {}) { return this.adapter.getMessage(messageId, tenantId); }
  async appendEvent(event) { if (!event?.id) throw new Error("event id is required"); if (!event?.message_id) throw new Error("message_id is required"); return this.adapter.appendEvent({ ...event, occurred_at: event.occurred_at || this.clock() }); }
  async listEvents(messageId, { tenantId } = {}) { return this.adapter.listEvents(messageId, tenantId); }
  async saveIdempotency(scope, key, value) { return this.adapter.saveIdempotency(scope, key, value); }
  async getIdempotency(scope, key) { return this.adapter.getIdempotency(scope, key); }
  async deleteIdempotency(scope, key) { return this.adapter.deleteIdempotency(scope, key); }
  async acceptAndEnqueue(input) { if (typeof this.adapter.acceptAndEnqueue !== "function") throw new Error("atomic_acceptance_unavailable"); return this.adapter.acceptAndEnqueue(input); }
  async snapshot() { return this.adapter.snapshot(); }
  async get(scope, key) { return this.getIdempotency(scope, key); }
  async put(scope, key, value) { return this.saveIdempotency(scope, key, value); }
  async delete(scope, key) { return this.deleteIdempotency(scope, key); }
}

export class MemoryMailStoreAdapter {
  constructor({ messages = new Map(), events = new Map(), idempotency = new Map(), outbox = null } = {}) { this.messages = messages; this.events = events; this.idempotency = idempotency; this.outbox = outbox; }
  async putMessage(message) { this.messages.set(message.message_id, structuredClone(message)); return structuredClone(message); }
  async getMessage(messageId, tenantId) { const message = this.messages.get(messageId); if (!message || (tenantId && message.tenant_id !== tenantId)) return null; return structuredClone(message); }
  async appendEvent(event) { if (this.events.has(event.id)) return { ...structuredClone(this.events.get(event.id)), duplicate: true }; this.events.set(event.id, structuredClone(event)); return structuredClone(event); }
  async listEvents(messageId, tenantId) { const message = await this.getMessage(messageId, tenantId); if (!message) return null; return [...this.events.values()].filter((event) => event.message_id === messageId).sort((a,b) => a.occurred_at.localeCompare(b.occurred_at)).map((event) => structuredClone(event)); }
  async saveIdempotency(scope, key, value) { this.idempotency.set(`${scope}:${key}`, structuredClone(value)); }
  async getIdempotency(scope, key) { const value = this.idempotency.get(`${scope}:${key}`); return value ? structuredClone(value) : null; }
  async deleteIdempotency(scope, key) { this.idempotency.delete(`${scope}:${key}`); }
  async acceptAndEnqueue(input) { const existing = await this.getIdempotency(input.scope, input.key); if (existing) return { inserted:false, fingerprint:existing.fingerprint, response:existing.response, queue_msg_id:null }; await this.putMessage(input.message); await this.appendEvent(input.event); await this.saveIdempotency(input.scope,input.key,input.idempotency); const queueMsgId=this.outbox?await this.outbox.enqueue(input.job):null; return { inserted:true,message_id:input.message.message_id,event_id:input.event.id,fingerprint:input.idempotency.fingerprint,response:input.idempotency.response,queue_msg_id:queueMsgId }; }
  async snapshot() { return { message_count:this.messages.size,event_count:this.events.size,idempotency_count:this.idempotency.size }; }
}

/** Server-side Supabase REST adapter. Service credentials remain server-side. */
export class SupabaseMailStoreAdapter {
  constructor({ projectUrl, serviceKey, fetchImpl = globalThis.fetch } = {}) { if (!projectUrl) throw new Error("projectUrl is required"); if (!serviceKey) throw new Error("serviceKey is required"); if (typeof fetchImpl !== "function") throw new Error("fetchImpl is required"); this.baseUrl=`${String(projectUrl).replace(/\/$/,"")}/rest/v1`; this.serviceKey=serviceKey; this.fetchImpl=fetchImpl; }
  async putMessage(message) { const row={message_id:message.message_id,tenant_id:message.tenant_id,app_id:message.app_id,status:message.status||"queued",envelope:message.envelope||{},metadata:message.metadata||{},created_at:message.created_at,updated_at:message.updated_at}; await this.request("iz_mail_messages",{method:"POST",body:[row],prefer:"resolution=merge-duplicates,return=minimal"}); return structuredClone(message); }
  async getMessage(messageId,tenantId) { const filters=[`message_id=eq.${encodeURIComponent(messageId)}`]; if(tenantId) filters.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`); const rows=await this.request(`iz_mail_messages?select=*&${filters.join("&")}`,{method:"GET"}); return rows[0]||null; }
  async appendEvent(event) { const row={id:event.id,message_id:event.message_id,tenant_id:event.tenant_id,recipient_id:event.recipient_id||null,type:event.type,data:event.data||{},occurred_at:event.occurred_at}; try { await this.request("iz_mail_events",{method:"POST",body:[row],prefer:"return=minimal"}); return structuredClone(event); } catch(error) { if(error?.status===409) return {...structuredClone(event),duplicate:true}; throw error; } }
  async listEvents(messageId,tenantId) { const message=await this.getMessage(messageId,tenantId); if(!message) return null; return this.request(`iz_mail_events?select=*&message_id=eq.${encodeURIComponent(messageId)}&order=occurred_at.asc`,{method:"GET"}); }
  async saveIdempotency(scope,key,value) { const row={scope,key,tenant_id:value.tenant_id||String(scope).split(":")[0],fingerprint:value.fingerprint,response:value.response,created_at:value.created_at}; try { await this.request("iz_mail_idempotency",{method:"POST",body:[row],prefer:"return=minimal"}); } catch(error) { if(error?.status===409) { const existing=await this.getIdempotency(scope,key); if(existing?.fingerprint===value.fingerprint) return existing; } throw error; } return value; }
  async getIdempotency(scope,key) { const rows=await this.request(`iz_mail_idempotency?select=*&scope=eq.${encodeURIComponent(scope)}&key=eq.${encodeURIComponent(key)}`,{method:"GET"}); if(!rows[0]) return null; return {fingerprint:rows[0].fingerprint,response:rows[0].response,statusCode:rows[0].response?.status_code||202,created_at:rows[0].created_at}; }
  async deleteIdempotency(scope,key) { await this.request(`iz_mail_idempotency?scope=eq.${encodeURIComponent(scope)}&key=eq.${encodeURIComponent(key)}`,{method:"DELETE",prefer:"return=minimal"}); }
  async acceptAndEnqueue(input) { const payload={p_scope:input.scope,p_idempotency_key:input.key,p_fingerprint:input.idempotency.fingerprint,p_message_id:input.message.message_id,p_event_id:input.event.id,p_tenant_id:input.message.tenant_id,p_app_id:input.message.app_id,p_kind:input.job.kind,p_envelope:input.message.envelope,p_metadata:input.message.metadata,p_accepted_at:input.message.created_at}; const rows=await this.request("rpc/accept_and_enqueue",{method:"POST",body:payload,prefer:"return=representation"}); const row=Array.isArray(rows)?rows[0]:rows; if(!row) throw new Error("atomic_acceptance_empty_response"); return row; }
  async snapshot() { const [messages,events,idempotency]=await Promise.all([this.count("iz_mail_messages"),this.count("iz_mail_events"),this.count("iz_mail_idempotency")]); return {message_count:messages,event_count:events,idempotency_count:idempotency}; }
  async count(table) { const response=await this.raw(`${table}?select=message_id&limit=1`,{method:"GET",headers:{Prefer:"count=exact"}}); const range=response.headers.get("content-range")||"*/0"; const total=Number(range.split("/")[1]); return Number.isFinite(total)?total:0; }
  async request(path,options={}) { const response=await this.raw(path,options); if(response.status===204) return null; const text=await response.text(); if(!text) return null; try{return JSON.parse(text);}catch{return text;} }
  async raw(path,{method="GET",body,prefer,headers:extraHeaders}={}) { const headers={apikey:this.serviceKey,Authorization:`Bearer ${this.serviceKey}`,"Content-Type":"application/json",...(prefer?{Prefer:prefer}:{}),...(extraHeaders||{})}; const response=await this.fetchImpl(`${this.baseUrl}/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}); if(!response.ok){const text=await response.text().catch(()=>""); const error=new Error(`Supabase Mail Store request failed (${response.status})${text?`: ${text}`:""}`); error.status=response.status; throw error;} return response; }
}
