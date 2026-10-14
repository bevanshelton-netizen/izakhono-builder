export interface Env { DB?: D1Database; OWNER_BOOKING_SECRET?: string; IKHOKHA_CHECKOUT_URL?: string; }

type Json = Record<string, unknown>;
const json = (data: Json, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const ownerOK = (request: Request, env: Env) => !env.OWNER_BOOKING_SECRET || request.headers.get('x-owner-secret') === env.OWNER_BOOKING_SECRET;
const bad = (message: string, status = 400) => json({ error: message }, status);

async function bookingExists(env: Env, serviceId: string, startsAt: string, endsAt: string) {
  if (!env.DB) return false;
  const row = await env.DB.prepare("SELECT id FROM bookings WHERE service_id=? AND status IN ('pending','confirmed') AND starts_at < ? AND ends_at > ? LIMIT 1").bind(serviceId, endsAt, startsAt).first<{ id: string }>();
  return Boolean(row);
}

export default { async fetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok:true, product:'IZAKHONO BOOKING v2', release_candidate:true, public_live:false, payment_provider:'iKhokha-ready', reminders:'queued' });

    if (request.method === 'GET' && url.pathname === '/api/services') {
      if (!env.DB) return json({ services:[], source:'no-database' });
      const businessId = url.searchParams.get('businessId'); if (!businessId) return bad('businessId_required');
      const rows = await env.DB.prepare('SELECT id,name,duration_minutes,price_minor FROM services WHERE business_id=? AND active=1 ORDER BY name').bind(businessId).all();
      return json({ services: rows.results, source:'d1' });
    }

    if (request.method === 'GET' && url.pathname === '/api/availability') {
      if (!env.DB) return json({ available:true, source:'no-database' });
      const serviceId=url.searchParams.get('serviceId'), from=url.searchParams.get('from'), to=url.searchParams.get('to');
      if (!serviceId || !from || !to) return bad('serviceId_from_to_required');
      const conflict=await bookingExists(env,serviceId,from,to);
      return json({ available:!conflict, conflict });
    }

    if (request.method === 'POST' && url.pathname === '/api/bookings') {
      if (!env.DB) return json({ error:'database_unconfigured', release_candidate:true }, 503);
      const body=await request.json<Json>();
      const required=['businessId','serviceId','customerName','customerEmail','startsAt','endsAt'];
      const missing=required.filter(k=>!body[k]); if(missing.length) return json({error:'missing_fields',fields:missing},400);
      const idem=request.headers.get('idempotency-key');
      if(idem){ const existing=await env.DB.prepare('SELECT id FROM bookings WHERE idempotency_key=?').bind(idem).first<{id:string}>(); if(existing) return json({bookingId:existing.id,replayed:true}); }
      if(await bookingExists(env,String(body.serviceId),String(body.startsAt),String(body.endsAt))) return bad('slot_unavailable',409);
      const customerId=crypto.randomUUID();
      const existingCustomer=await env.DB.prepare('SELECT id FROM customers WHERE business_id=? AND email=?').bind(body.businessId,body.customerEmail).first<{id:string}>();
      const cid=existingCustomer?.id ?? customerId;
      if(!existingCustomer) await env.DB.prepare('INSERT INTO customers (id,business_id,name,email,phone) VALUES (?,?,?,?,?)').bind(cid,body.businessId,body.customerName,body.customerEmail,body.customerPhone ?? null).run();
      const bookingId=crypto.randomUUID();
      await env.DB.prepare('INSERT INTO bookings (id,business_id,service_id,customer_id,starts_at,ends_at,status,payment_status,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?)').bind(bookingId,body.businessId,body.serviceId,cid,body.startsAt,body.endsAt,'pending','unpaid',idem).run();
      return json({booking:{id:bookingId,status:'pending',paymentStatus:'unpaid'},confirmation:'booking_received'},201);
    }

    const match=url.pathname.match(/^\/api\/bookings\/([^/]+)\/(confirm|cancel|checkout)$/);
    if(request.method==='POST' && match){
      if(!ownerOK(request,env) && match[2] !== 'checkout') return bad('owner_auth_required',401);
      if(!env.DB) return bad('database_unconfigured',503);
      const id=match[1], action=match[2];
      const booking=await env.DB.prepare('SELECT b.id,b.status,b.payment_status,s.price_minor,business_id FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.id=?').bind(id).first<any>();
      if(!booking) return bad('booking_not_found',404);
      if(action==='confirm'){ await env.DB.prepare("UPDATE bookings SET status='confirmed' WHERE id=? AND status='pending'").bind(id).run(); return json({ok:true,bookingId:id,status:'confirmed'}); }
      if(action==='cancel'){ await env.DB.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND status IN ('pending','confirmed')").bind(id).run(); return json({ok:true,bookingId:id,status:'cancelled'}); }
      const provider=env.IKHOKHA_CHECKOUT_URL ? 'ikhokha' : 'unconfigured';
      const intentId=crypto.randomUUID();
      await env.DB.prepare('INSERT INTO payment_intents (id,booking_id,provider,amount_minor,currency,status,checkout_url) VALUES (?,?,?,?,?,?,?)').bind(intentId,id,provider,booking.price_minor,'ZAR',provider==='ikhokha'?'pending':'created',env.IKHOKHA_CHECKOUT_URL ?? null).run();
      return json({paymentIntentId:intentId,provider,status:provider==='ikhokha'?'pending':'provider_unconfigured',checkoutUrl:env.IKHOKHA_CHECKOUT_URL ?? null});
    }

    if(request.method==='POST' && url.pathname==='/api/reminders/enqueue'){
      if(!ownerOK(request,env)) return bad('owner_auth_required',401); if(!env.DB) return bad('database_unconfigured',503);
      const body=await request.json<Json>(); const bookingId=String(body.bookingId||''); if(!bookingId) return bad('bookingId_required');
      const booking=await env.DB.prepare('SELECT id,starts_at FROM bookings WHERE id=? AND status="confirmed"').bind(bookingId).first<any>(); if(!booking) return bad('confirmed_booking_not_found',404);
      const due=new Date(new Date(booking.starts_at).getTime()-24*60*60*1000).toISOString(); const jobId=crypto.randomUUID();
      await env.DB.prepare('INSERT OR IGNORE INTO reminder_jobs (id,booking_id,channel,due_at,status) VALUES (?,?,?,?,?)').bind(jobId,bookingId,String(body.channel||'email'),due,'queued').run();
      return json({queued:true,bookingId,dueAt:due});
    }

    if(request.method==='GET' && url.pathname==='/api/dashboard/summary'){
      if(!ownerOK(request,env)) return bad('owner_auth_required',401); if(!env.DB) return json({bookings:0,confirmed:0,pending:0,paid:0,revenueMinor:0,source:'no-database'});
      const row=await env.DB.prepare("SELECT COUNT(*) bookings,SUM(status='confirmed') confirmed,SUM(status='pending') pending,SUM(payment_status='paid') paid,COALESCE(SUM(CASE WHEN payment_status='paid' THEN s.price_minor ELSE 0 END),0) revenueMinor FROM bookings b JOIN services s ON s.id=b.service_id").first<any>();
      return json({...row,source:'d1'});
    }
    return new Response('IZAKHONO BOOKING v2',{status:404});
  } catch (error) { return json({error:'request_failed',message:error instanceof Error?error.message:'unknown_error'},500); }
} };
