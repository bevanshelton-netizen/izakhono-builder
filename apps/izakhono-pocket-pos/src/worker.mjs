const te=new TextEncoder();
const SESSION_COOKIE='pp_session';
const ROLES={owner:4,manager:3,supervisor:2,cashier:1};

function j(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}})}
function bad(message,status=400){return j({ok:false,error:message},status)}
function id(prefix){return prefix+'_'+crypto.randomUUID().replaceAll('-','')}
function clean(v,max=200){return typeof v==='string'?v.trim().slice(0,max):''}
function cookie(req,name){const raw=req.headers.get('cookie')||'';for(const p of raw.split(';')){const [k,...v]=p.trim().split('=');if(k===name)return decodeURIComponent(v.join('='))}return''}
function hex(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function sha256(v){return hex(await crypto.subtle.digest('SHA-256',te.encode(v)))}
async function hmac(secret,payload){const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,te.encode(payload)))}
function safeEq(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0}
function bytesHex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
function hexBytes(str){const out=new Uint8Array(str.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(str.slice(i*2,i*2+2),16);return out}
async function pinHash(pin,saltHex){const salt=saltHex?hexBytes(saltHex):crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey('raw',te.encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:210000},key,256);return{salt:bytesHex(salt),hash:hex(bits)}}
async function parse(req){if(!(req.headers.get('content-type')||'').includes('application/json'))throw new Error('Expected application/json');return req.json()}
function sameOrigin(req){const o=req.headers.get('origin');return !o||o===new URL(req.url).origin}
function roleAtLeast(user,role){return user&&ROLES[user.role]>=ROLES[role]}

async function session(req,env){
 const token=cookie(req,SESSION_COOKIE)||(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!token)return null;
 const tokenHash=await sha256(token);
 const row=await env.DB.prepare(`SELECT s.id session_id,s.staff_id,s.expires_at,st.merchant_id,st.name,st.email,st.phone,st.role,st.disabled
 FROM pp_sessions s JOIN pp_staff st ON st.id=s.staff_id
 WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP`).bind(tokenHash).first();
 if(!row||row.disabled)return null;
 return row;
}
async function audit(env,user,action,type='',entity='',meta={}){
 await env.DB.prepare('INSERT INTO pp_audit_log(id,merchant_id,staff_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)')
 .bind(id('aud'),user.merchant_id,user.staff_id,action,type,entity,JSON.stringify(meta).slice(0,4000)).run();
}
async function requireUser(req,env,role='cashier'){const u=await session(req,env);if(!u)return{error:bad('Authentication required',401)};if(!roleAtLeast(u,role))return{error:bad('Insufficient permission',403)};return{user:u}}
function noCrossSite(req){if(!sameOrigin(req))return bad('Cross-origin state changes are not allowed',403);return null}

async function settle(env,user,saleId,method,providerId=null){
 const sale=await env.DB.prepare('SELECT * FROM pp_sales WHERE id=? AND merchant_id=?').bind(saleId,user.merchant_id).first();
 if(!sale)return bad('Sale not found',404);
 if(sale.status==='paid')return j({ok:true,idempotent:true,sale});
 if(sale.status!=='pending')return bad('Sale is not payable',409);
 const items=(await env.DB.prepare('SELECT product_id,quantity FROM pp_sale_items WHERE sale_id=? AND product_id IS NOT NULL').bind(saleId).all()).results||[];
 const checks=[];
 for(const it of items){
  const inv=await env.DB.prepare('SELECT on_hand FROM pp_inventory WHERE branch_id=? AND product_id=?').bind(sale.branch_id,it.product_id).first();
  if(!inv||Number(inv.on_hand)<Number(it.quantity))return bad('Insufficient stock to settle sale',409);
  checks.push(it);
 }
 const stmts=[];
 for(const it of checks)stmts.push(env.DB.prepare('UPDATE pp_inventory SET on_hand=on_hand-?,updated_at=CURRENT_TIMESTAMP WHERE branch_id=? AND product_id=? AND on_hand>=?').bind(it.quantity,sale.branch_id,it.product_id,it.quantity));
 stmts.push(env.DB.prepare("UPDATE pp_sales SET status='paid',payment_method=?,external_payment_id=COALESCE(?,external_payment_id),paid_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(method,providerId,saleId));
 stmts.push(env.DB.prepare('INSERT INTO pp_audit_log(id,merchant_id,staff_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)').bind(id('aud'),user.merchant_id,user.staff_id,'sale.paid','sale',saleId,JSON.stringify({method,providerId})));
 await env.DB.batch(stmts);
 return j({ok:true,sale_id:saleId,status:'paid'});
}

function ikEscape(str){return str.replace(/[\\"']/g,'\\$&').replace(/\u0000/g,'\\0')}
async function ikSignature(secret,path,body){return hmac(secret,ikEscape(path+body))}

async function api(req,env,url){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':url.origin,'access-control-allow-headers':'content-type,authorization,x-bootstrap-secret','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'}});
 if(url.pathname==='/api/health'&&req.method==='GET'){let db=false;try{const r=await env.DB.prepare('SELECT 1 ok').first();db=r?.ok===1}catch{}return j({ok:db,service:'IZAKHONO PocketPOS Engine',version:'0.3.0',payment_provider:env.IK_APP_ID?'ikhokha-configured':'not-configured'})}

 if(url.pathname==='/api/admin/bootstrap'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;
  if(!env.BOOTSTRAP_SECRET||!safeEq(req.headers.get('x-bootstrap-secret')||'',env.BOOTSTRAP_SECRET))return bad('Bootstrap denied',403);
  const existing=await env.DB.prepare('SELECT COUNT(*) n FROM pp_merchants').first();if(Number(existing?.n||0)>0)return bad('Bootstrap already completed',409);
  const b=await parse(req),legal=clean(b.legal_name,140),trading=clean(b.trading_name,140),slug=clean(b.slug,60).toLowerCase(),owner=clean(b.owner_name,120),email=clean(b.owner_email,180).toLowerCase(),phone=clean(b.owner_phone,40),pin=clean(b.pin,20);
  if(!legal||!trading||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!owner||pin.length<6)return bad('legal_name, trading_name, slug, owner_name and PIN of at least 6 digits are required');
  if(!/^\d{6,20}$/.test(pin))return bad('PIN must contain digits only');
  const ph=await pinHash(pin),mid=id('mer'),bid=id('br'),sid=id('usr');
  await env.DB.batch([
   env.DB.prepare('INSERT INTO pp_merchants(id,slug,legal_name,trading_name,currency,tax_rate) VALUES(?,?,?,?,?,?)').bind(mid,slug,legal,trading,'ZAR',Number(b.tax_rate??15)),
   env.DB.prepare('INSERT INTO pp_branches(id,merchant_id,name,active) VALUES(?,?,?,1)').bind(bid,mid,clean(b.branch_name,100)||'Main Branch'),
   env.DB.prepare("INSERT INTO pp_staff(id,merchant_id,name,email,phone,role,pin_salt,pin_hash) VALUES(?,?,?,?,?,'owner',?,?)").bind(sid,mid,owner,email||null,phone||null,ph.salt,ph.hash),
   env.DB.prepare('INSERT INTO pp_audit_log(id,merchant_id,staff_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)').bind(id('aud'),mid,sid,'merchant.bootstrap','merchant',mid,'{}')
  ]);
  return j({ok:true,merchant_id:mid,slug,branch_id:bid,owner_id:sid},201);
 }

 if(url.pathname==='/api/admin/merchants'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;
  if(!env.ADMIN_SECRET||!safeEq(req.headers.get('x-admin-secret')||'',env.ADMIN_SECRET))return bad('Admin denied',403);
  const b=await parse(req),legal=clean(b.legal_name,140),trading=clean(b.trading_name,140),slug=clean(b.slug,60).toLowerCase(),owner=clean(b.owner_name,120),email=clean(b.owner_email,180).toLowerCase(),phone=clean(b.owner_phone,40),pin=clean(b.pin,20);
  if(!legal||!trading||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!owner||!/^\d{6,20}$/.test(pin))return bad('legal_name, trading_name, valid slug, owner_name and 6+ digit PIN are required');
  const duplicate=await env.DB.prepare('SELECT id FROM pp_merchants WHERE slug=?').bind(slug).first();if(duplicate)return bad('Merchant slug already exists',409);
  const ph=await pinHash(pin),mid=id('mer'),bid=id('br'),sid=id('usr');
  await env.DB.batch([
   env.DB.prepare('INSERT INTO pp_merchants(id,slug,legal_name,trading_name,currency,tax_rate) VALUES(?,?,?,?,?,?)').bind(mid,slug,legal,trading,'ZAR',Number(b.tax_rate??15)),
   env.DB.prepare('INSERT INTO pp_branches(id,merchant_id,name,address,active) VALUES(?,?,?,?,1)').bind(bid,mid,clean(b.branch_name,100)||'Main Branch',clean(b.branch_address,240)||null),
   env.DB.prepare("INSERT INTO pp_staff(id,merchant_id,name,email,phone,role,pin_salt,pin_hash) VALUES(?,?,?,?,?,'owner',?,?)").bind(sid,mid,owner,email||null,phone||null,ph.salt,ph.hash),
   env.DB.prepare('INSERT INTO pp_audit_log(id,merchant_id,staff_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)').bind(id('aud'),mid,sid,'merchant.provision','merchant',mid,JSON.stringify({provisioned_by:'platform-admin'}))
  ]);
  return j({ok:true,merchant_id:mid,slug,branch_id:bid,owner_id:sid},201);
 }

 if(url.pathname==='/api/auth/login'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;
  const b=await parse(req),slug=clean(b.slug,60).toLowerCase(),identity=clean(b.identity,180).toLowerCase(),pin=clean(b.pin,20);
  const st=await env.DB.prepare(`SELECT st.*,m.slug FROM pp_staff st JOIN pp_merchants m ON m.id=st.merchant_id
  WHERE m.slug=? AND st.disabled=0 AND (lower(COALESCE(st.email,''))=? OR st.phone=? OR st.id=?) LIMIT 1`).bind(slug,identity,identity,identity).first();
  if(!st||!st.pin_salt||!st.pin_hash)return bad('Invalid credentials',401);
  const ph=await pinHash(pin,st.pin_salt);if(!safeEq(ph.hash,st.pin_hash))return bad('Invalid credentials',401);
  const token=bytesHex(crypto.getRandomValues(new Uint8Array(32))),th=await sha256(token),sess=id('ses');
  await env.DB.prepare("INSERT INTO pp_sessions(id,staff_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+12 hours'))").bind(sess,st.id,th).run();
  const headers={'set-cookie':SESSION_COOKIE+'='+encodeURIComponent(token)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200'};
  return j({ok:true,user:{id:st.id,name:st.name,role:st.role,merchant_id:st.merchant_id}},200,headers);
 }

 if(url.pathname==='/api/auth/logout'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;const u=await session(req,env);if(u)await env.DB.prepare('UPDATE pp_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=?').bind(u.session_id).run();
  return j({ok:true},200,{'set-cookie':SESSION_COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
 }

 const auth=await requireUser(req,env);if(auth.error)return auth.error;const user=auth.user;

 if(url.pathname==='/api/me'&&req.method==='GET')return j({ok:true,user:{id:user.staff_id,name:user.name,role:user.role,merchant_id:user.merchant_id}});
 if(url.pathname==='/api/bootstrap'&&req.method==='GET'){
  const merchant=await env.DB.prepare('SELECT id,slug,legal_name,trading_name,currency,tax_rate FROM pp_merchants WHERE id=?').bind(user.merchant_id).first();
  const [branches,products,inventory,customers,staff]=await Promise.all([
   env.DB.prepare('SELECT id,name,address,active FROM pp_branches WHERE merchant_id=? AND active=1 ORDER BY name').bind(user.merchant_id).all(),
   env.DB.prepare('SELECT id,sku,barcode,name,price_minor,active FROM pp_products WHERE merchant_id=? AND active=1 ORDER BY name').bind(user.merchant_id).all(),
   env.DB.prepare('SELECT i.branch_id,i.product_id,i.on_hand FROM pp_inventory i JOIN pp_branches b ON b.id=i.branch_id WHERE b.merchant_id=?').bind(user.merchant_id).all(),
   env.DB.prepare('SELECT id,name,phone,email FROM pp_customers WHERE merchant_id=? ORDER BY name LIMIT 1000').bind(user.merchant_id).all(),
   roleAtLeast(user,'manager')?env.DB.prepare('SELECT id,name,email,phone,role,disabled FROM pp_staff WHERE merchant_id=? ORDER BY name').bind(user.merchant_id).all():Promise.resolve({results:[]})
  ]);
  return j({ok:true,merchant,branches:branches.results||[],products:products.results||[],inventory:inventory.results||[],customers:customers.results||[],staff:staff.results||[],user:{id:user.staff_id,name:user.name,role:user.role}});
 }

 if(url.pathname==='/api/devices/enrol'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;const b=await parse(req),branchId=clean(b.branch_id,80)||null;
  if(branchId){const br=await env.DB.prepare('SELECT id FROM pp_branches WHERE id=? AND merchant_id=? AND active=1').bind(branchId,user.merchant_id).first();if(!br)return bad('Branch not found',404)}
  const did=id('dev');await env.DB.prepare('INSERT INTO pp_devices(id,merchant_id,branch_id,label,platform) VALUES(?,?,?,?,?)').bind(did,user.merchant_id,branchId,clean(b.label,120)||'PocketPOS device',clean(b.platform,120)||req.headers.get('user-agent')?.slice(0,120)||null).run();await audit(env,user,'device.enrol','device',did,{branchId});return j({ok:true,id:did},201);
 }
 if(url.pathname==='/api/devices'&&req.method==='GET'){
  if(!roleAtLeast(user,'manager'))return bad('Manager permission required',403);const rows=await env.DB.prepare('SELECT id,branch_id,label,platform,enrolled_at,revoked_at FROM pp_devices WHERE merchant_id=? ORDER BY enrolled_at DESC').bind(user.merchant_id).all();return j({ok:true,devices:rows.results||[]});
 }

 if(url.pathname==='/api/branches'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;if(!roleAtLeast(user,'owner'))return bad('Owner permission required',403);const b=await parse(req),name=clean(b.name,100);if(!name)return bad('Branch name required');
  const bid=id('br');await env.DB.prepare('INSERT INTO pp_branches(id,merchant_id,name,address,active) VALUES(?,?,?,?,1)').bind(bid,user.merchant_id,name,clean(b.address,240)||null).run();await audit(env,user,'branch.create','branch',bid,{name});return j({ok:true,id:bid},201);
 }

 if(url.pathname==='/api/customers'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;const b=await parse(req),name=clean(b.name,120);if(!name)return bad('Customer name required');const cid=id('cus');
  await env.DB.prepare('INSERT INTO pp_customers(id,merchant_id,name,phone,email) VALUES(?,?,?,?,?)').bind(cid,user.merchant_id,name,clean(b.phone,40)||null,clean(b.email,180).toLowerCase()||null).run();await audit(env,user,'customer.create','customer',cid,{});return j({ok:true,id:cid},201);
 }

 if(url.pathname==='/api/staff'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;if(!roleAtLeast(user,'manager'))return bad('Manager permission required',403);const b=await parse(req),name=clean(b.name,120),role=clean(b.role,30).toLowerCase(),pin=clean(b.pin,20);
  if(!name||!['manager','supervisor','cashier'].includes(role)||!/^\d{6,20}$/.test(pin))return bad('name, valid role and 6+ digit PIN required');if(role==='manager'&&!roleAtLeast(user,'owner'))return bad('Only owner may add a manager',403);
  const ph=await pinHash(pin),sid=id('usr');await env.DB.prepare('INSERT INTO pp_staff(id,merchant_id,name,email,phone,role,pin_salt,pin_hash) VALUES(?,?,?,?,?,?,?,?)').bind(sid,user.merchant_id,name,clean(b.email,180).toLowerCase()||null,clean(b.phone,40)||null,role,ph.salt,ph.hash).run();await audit(env,user,'staff.create','staff',sid,{role});return j({ok:true,id:sid},201);
 }

 if(url.pathname==='/api/products'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;if(!roleAtLeast(user,'manager'))return bad('Manager permission required',403);const b=await parse(req),name=clean(b.name,140),sku=clean(b.sku,80),barcode=clean(b.barcode,80),price=Number(b.price_minor);
  if(!name||!sku||!Number.isInteger(price)||price<0)return bad('name, sku and integer price_minor are required');const pid=id('prd');
  await env.DB.prepare('INSERT INTO pp_products(id,merchant_id,sku,barcode,name,price_minor,active) VALUES(?,?,?,?,?,?,1)').bind(pid,user.merchant_id,sku,barcode||null,name,price).run();
  const branches=(await env.DB.prepare('SELECT id FROM pp_branches WHERE merchant_id=? AND active=1').bind(user.merchant_id).all()).results||[];if(branches.length)await env.DB.batch(branches.map(br=>env.DB.prepare('INSERT INTO pp_inventory(branch_id,product_id,on_hand) VALUES(?,?,0)').bind(br.id,pid)));await audit(env,user,'product.create','product',pid,{sku});return j({ok:true,id:pid},201);
 }

 if(url.pathname==='/api/stock/adjustments'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;if(!roleAtLeast(user,'supervisor'))return bad('Supervisor permission required',403);const b=await parse(req),branchId=clean(b.branch_id,80),productId=clean(b.product_id,80),delta=Number(b.delta);
  if(!Number.isInteger(delta)||delta===0)return bad('Integer non-zero delta required');const br=await env.DB.prepare('SELECT id FROM pp_branches WHERE id=? AND merchant_id=?').bind(branchId,user.merchant_id).first(),pr=await env.DB.prepare('SELECT id FROM pp_products WHERE id=? AND merchant_id=?').bind(productId,user.merchant_id).first();if(!br||!pr)return bad('Unknown branch or product',404);
  const cur=await env.DB.prepare('SELECT on_hand FROM pp_inventory WHERE branch_id=? AND product_id=?').bind(branchId,productId).first();const next=Number(cur?.on_hand||0)+delta;if(next<0)return bad('Adjustment would make stock negative',409);await env.DB.prepare('INSERT INTO pp_inventory(branch_id,product_id,on_hand,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(branch_id,product_id) DO UPDATE SET on_hand=excluded.on_hand,updated_at=CURRENT_TIMESTAMP').bind(branchId,productId,next).run();await audit(env,user,'stock.adjust','product',productId,{branchId,delta,next,reason:clean(b.reason,200)});return j({ok:true,on_hand:next});
 }

 if(url.pathname==='/api/sales'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;const b=await parse(req),branchId=clean(b.branch_id,80),customerId=clean(b.customer_id,80)||null,items=Array.isArray(b.items)?b.items:[],idem=clean(req.headers.get('idempotency-key'),120);
  if(!idem||items.length<1||items.length>100)return bad('Idempotency-Key and 1-100 items required');const prev=await env.DB.prepare('SELECT id,status,total_minor FROM pp_sales WHERE merchant_id=? AND idempotency_key=?').bind(user.merchant_id,idem).first();if(prev)return j({ok:true,idempotent:true,sale:prev});
  const br=await env.DB.prepare('SELECT id FROM pp_branches WHERE id=? AND merchant_id=? AND active=1').bind(branchId,user.merchant_id).first();if(!br)return bad('Branch not found',404);
  let subtotal=0;const lines=[];
  for(const it of items){const qty=Number(it.quantity);if(!Number.isInteger(qty)||qty<1||qty>999)return bad('Invalid quantity');if(it.product_id){const p=await env.DB.prepare('SELECT id,name,price_minor FROM pp_products WHERE id=? AND merchant_id=? AND active=1').bind(clean(it.product_id,80),user.merchant_id).first();if(!p)return bad('Product not found',404);const inv=await env.DB.prepare('SELECT on_hand FROM pp_inventory WHERE branch_id=? AND product_id=?').bind(branchId,p.id).first();if(Number(inv?.on_hand||0)<qty)return bad('Insufficient stock for '+p.name,409);const line=Number(p.price_minor)*qty;subtotal+=line;lines.push({product_id:p.id,description:p.name,quantity:qty,unit:Number(p.price_minor),line})}else{if(!roleAtLeast(user,'supervisor'))return bad('Quick sale requires supervisor permission',403);const desc=clean(it.description,120)||'Quick sale',unit=Number(it.unit_price_minor);if(!Number.isInteger(unit)||unit<0)return bad('Invalid quick-sale price');const line=unit*qty;subtotal+=line;lines.push({product_id:null,description:desc,quantity:qty,unit,line})}}
  const mer=await env.DB.prepare('SELECT tax_rate FROM pp_merchants WHERE id=?').bind(user.merchant_id).first();const rate=Number(mer?.tax_rate||0)/100,tax=rate?Math.round(subtotal-(subtotal/(1+rate))):0,saleId=id('sal');
  const stmts=[env.DB.prepare("INSERT INTO pp_sales(id,merchant_id,branch_id,staff_id,customer_id,status,payment_method,subtotal_minor,tax_minor,total_minor,idempotency_key) VALUES(?,?,?,?,?,'pending','pending',?,?,?,?,?)").bind(saleId,user.merchant_id,branchId,user.staff_id,customerId,subtotal,tax,subtotal,idem)];
  for(const line of lines)stmts.push(env.DB.prepare('INSERT INTO pp_sale_items(id,sale_id,product_id,description,quantity,unit_price_minor,line_total_minor) VALUES(?,?,?,?,?,?,?)').bind(id('itm'),saleId,line.product_id,line.description,line.quantity,line.unit,line.line));
  await env.DB.batch(stmts);await audit(env,user,'sale.create','sale',saleId,{branchId,total_minor:subtotal});return j({ok:true,sale:{id:saleId,status:'pending',subtotal_minor:subtotal,tax_minor:tax,total_minor:subtotal}},201);
 }

 const cash=url.pathname.match(/^\/api\/sales\/([^/]+)\/cash$/);if(cash&&req.method==='POST'){const cross=noCrossSite(req);if(cross)return cross;return settle(env,user,cash[1],'cash')}
 const eft=url.pathname.match(/^\/api\/sales\/([^/]+)\/eft$/);if(eft&&req.method==='POST'){const cross=noCrossSite(req);if(cross)return cross;if(!roleAtLeast(user,'supervisor'))return bad('Supervisor verification required for EFT',403);return settle(env,user,eft[1],'eft')}

 if(url.pathname==='/api/payments/ikpay/session'&&req.method==='POST'){
  const cross=noCrossSite(req);if(cross)return cross;if(!env.IK_APP_ID||!env.IK_APP_SECRET||!env.PUBLIC_BASE_URL)return bad('iK Pay API is not configured on this engine',503);
  const b=await parse(req),saleId=clean(b.sale_id,100),sale=await env.DB.prepare("SELECT id,total_minor,status FROM pp_sales WHERE id=? AND merchant_id=?").bind(saleId,user.merchant_id).first();if(!sale)return bad('Sale not found',404);if(sale.status!=='pending')return bad('Sale is not pending',409);
  const base=new URL(env.PUBLIC_BASE_URL),path='/public-api/v1/api/payment',endpoint='https://api.ikhokha.com'+path;
  const payload={entityID:env.IK_APP_ID,externalEntityID:user.merchant_id,amount:Number(sale.total_minor),currency:'ZAR',requesterUrl:base.origin,mode:env.IK_MODE||'live',description:'PocketPOS sale '+saleId,paymentReference:saleId,externalTransactionID:saleId,urls:{callbackUrl:base.origin+'/api/payments/ikhokha/webhook',successPageUrl:base.origin+'/?payment=success&sale='+encodeURIComponent(saleId),failurePageUrl:base.origin+'/?payment=failure&sale='+encodeURIComponent(saleId),cancelUrl:base.origin+'/?payment=cancel&sale='+encodeURIComponent(saleId)}};
  const body=JSON.stringify(payload),sig=await ikSignature(env.IK_APP_SECRET,path,body),res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','accept':'application/json','IK-APPID':env.IK_APP_ID,'IK-SIGN':sig},body}),text=await res.text();let data={};try{data=JSON.parse(text)}catch{data={message:text.slice(0,500)}}
  if(!res.ok||data.responseCode&&data.responseCode!=='00'){await audit(env,user,'payment.ikpay.create_failed','sale',saleId,{status:res.status,responseCode:data.responseCode||null});return bad('iK Pay session creation failed',502)}
  if(data.paylinkID)await env.DB.prepare('UPDATE pp_sales SET external_payment_id=? WHERE id=?').bind(String(data.paylinkID),saleId).run();await audit(env,user,'payment.ikpay.created','sale',saleId,{paylinkID:data.paylinkID||null});return j({ok:true,paylinkUrl:data.paylinkUrl,paylinkID:data.paylinkID,externalTransactionID:data.externalTransactionID});
 }

 const rep=url.pathname.match(/^\/api\/sales\/([^/]+)\/receipt$/);if(rep&&req.method==='GET'){const sale=await env.DB.prepare('SELECT s.*,b.name branch_name,c.name customer_name,st.name staff_name,m.trading_name,m.currency FROM pp_sales s JOIN pp_branches b ON b.id=s.branch_id JOIN pp_staff st ON st.id=s.staff_id JOIN pp_merchants m ON m.id=s.merchant_id LEFT JOIN pp_customers c ON c.id=s.customer_id WHERE s.id=? AND s.merchant_id=?').bind(rep[1],user.merchant_id).first();if(!sale)return bad('Sale not found',404);const items=(await env.DB.prepare('SELECT description,quantity,unit_price_minor,line_total_minor FROM pp_sale_items WHERE sale_id=?').bind(rep[1]).all()).results||[];return j({ok:true,receipt:{sale,items}})}

 if(url.pathname==='/api/dashboard'&&req.method==='GET'){
  const branchId=clean(url.searchParams.get('branch_id'),80),day=clean(url.searchParams.get('day'),20)||new Date().toISOString().slice(0,10);let where='s.merchant_id=? AND date(s.created_at)=? AND s.status=\'paid\'',args=[user.merchant_id,day];if(branchId){const br=await env.DB.prepare('SELECT id FROM pp_branches WHERE id=? AND merchant_id=?').bind(branchId,user.merchant_id).first();if(!br)return bad('Branch not found',404);where+=' AND s.branch_id=?';args.push(branchId)}const sum=await env.DB.prepare('SELECT COUNT(*) transactions,COALESCE(SUM(total_minor),0) turnover_minor,COALESCE(SUM(tax_minor),0) tax_minor FROM pp_sales s WHERE '+where).bind(...args).first();const mix=(await env.DB.prepare('SELECT payment_method,COUNT(*) transactions,COALESCE(SUM(total_minor),0) total_minor FROM pp_sales s WHERE '+where+' GROUP BY payment_method ORDER BY total_minor DESC').bind(...args).all()).results||[];return j({ok:true,day,summary:sum,payment_mix:mix});
 }

 return bad('Not found',404);
}

async function webhook(req,env,url){
 if(req.method!=='POST')return bad('Method not allowed',405);if(!env.IK_APP_ID||!env.IK_APP_SECRET)return bad('Provider not configured',503);
 const raw=await req.text();let b;try{b=JSON.parse(raw)}catch{return bad('Invalid JSON')};const app=req.headers.get('ik-appid')||'',sig=req.headers.get('ik-sign')||'';if(!safeEq(app,env.IK_APP_ID))return bad('Invalid app id',403);const body=JSON.stringify(b),expected=await ikSignature(env.IK_APP_SECRET,url.pathname,body);if(!safeEq(sig.toLowerCase(),expected.toLowerCase()))return bad('Invalid signature',403);
 const saleId=clean(b.externalTransactionID,100),paylink=clean(b.paylinkID,120),eventId=paylink+':'+clean(b.status,30)+':'+clean(b.responseCode,20);const sale=await env.DB.prepare('SELECT * FROM pp_sales WHERE id=?').bind(saleId).first();if(!sale)return bad('Unknown sale',404);
 try{await env.DB.prepare('INSERT INTO pp_payment_events(id,sale_id,provider,provider_event_id,event_type,verified,payload_json) VALUES(?,?,?,?,?,1,?)').bind(id('pev'),saleId,'ikhokha',eventId,clean(b.status,30),JSON.stringify(b).slice(0,8000)).run()}catch{return j({ok:true,idempotent:true})}
 if(String(b.status).toUpperCase()==='SUCCESS'&&String(b.responseCode)==='00'&&sale.status==='pending'){
  const systemUser={merchant_id:sale.merchant_id,staff_id:sale.staff_id,role:'owner'};return settle(env,systemUser,saleId,'ikhokha-online',paylink||null)
 }
 return j({ok:true,status:'recorded'});
}

export default{async fetch(req,env){
 const url=new URL(req.url);
 try{
  if(url.pathname==='/api/payments/ikhokha/webhook')return webhook(req,env,url);
  if(url.pathname.startsWith('/api/'))return api(req,env,url);
  return env.ASSETS.fetch(req);
 }catch(e){console.error(e);return bad('Internal error',500)}
}};
