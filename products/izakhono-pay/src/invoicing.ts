export type InvoiceStatus = 'draft'|'sent'|'partially_paid'|'paid'|'overdue'|'void';

const id=(p:string)=>`${p}_${crypto.randomUUID()}`;
const now=()=>new Date().toISOString();
const clean=(v:unknown,max=500)=>String(v??'').trim().slice(0,max);
const money=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:null};
const json=(v:unknown)=>JSON.stringify(v??{});

export function invoiceLine(description:unknown,quantity:unknown,unitAmount:unknown,taxRate:unknown){
  const q=Number(quantity), u=money(unitAmount), tr=Number(taxRate??0);
  if(!clean(description,300)||!Number.isFinite(q)||q<=0||u===null||!Number.isFinite(tr)||tr<0||tr>100) return null;
  const subtotal=Math.round(q*u*100)/100;
  const tax=Math.round(subtotal*tr/100*100)/100;
  return {description:clean(description,300),quantity:q,unitAmount:u,taxRate:tr,lineTotal:Math.round((subtotal+tax)*100)/100,subtotal,tax};
}

export async function createCustomer(db:D1Database,merchantId:string,input:Record<string,unknown>){
  const name=clean(input.name,160); if(!name) throw new Error('customer_name_required');
  const customerId=id('cus'), t=now();
  await db.prepare('INSERT INTO pay_customers (id,merchant_id,name,email,phone,external_ref,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(customerId,merchantId,name,clean(input.email,254)||null,clean(input.phone,50)||null,clean(input.external_ref,160)||null,'active',t,t).run();
  return {id:customerId,merchant_id:merchantId,name,email:clean(input.email,254)||null,phone:clean(input.phone,50)||null,status:'active',created_at:t,updated_at:t};
}

export async function createInvoice(db:D1Database,merchantId:string,input:Record<string,unknown>){
  const currency=clean(input.currency||'ZAR',8).toUpperCase();
  const invoiceNumber=clean(input.invoice_number,80);
  const items=Array.isArray(input.items)?input.items:[];
  if(!invoiceNumber) throw new Error('invoice_number_required');
  if(!/^[A-Z]{3}$/.test(currency)) throw new Error('invalid_currency');
  if(!items.length) throw new Error('invoice_items_required');
  const lines=items.map(x=>invoiceLine((x as any)?.description,(x as any)?.quantity,(x as any)?.unit_amount,(x as any)?.tax_rate));
  if(lines.some(x=>!x)) throw new Error('invalid_invoice_item');
  const valid=lines as NonNullable<ReturnType<typeof invoiceLine>>[];
  const subtotal=Math.round(valid.reduce((s,x)=>s+x.subtotal,0)*100)/100;
  const tax=Math.round(valid.reduce((s,x)=>s+x.tax,0)*100)/100;
  const total=Math.round((subtotal+tax)*100)/100;
  const invoiceId=id('inv'), token=crypto.randomUUID().replaceAll('-',''), t=now();
  await db.prepare('INSERT INTO pay_invoices (id,merchant_id,customer_id,invoice_number,currency,subtotal,tax,total,amount_paid,balance_due,status,due_at,issued_at,notes,payment_token,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(invoiceId,merchantId,clean(input.customer_id,120)||null,invoiceNumber,currency,subtotal,tax,total,0,total,'draft',clean(input.due_at,60)||null,null,clean(input.notes,2000)||null,token,t,t).run();
  for(const line of valid){await db.prepare('INSERT INTO pay_invoice_items (id,invoice_id,description,quantity,unit_amount,tax_rate,line_total,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id('item'),invoiceId,line.description,line.quantity,line.unitAmount,line.taxRate,line.lineTotal,t).run();}
  await recordInvoiceEvent(db,invoiceId,'invoice.created',{invoice_number:invoiceNumber,total,currency});
  return {id:invoiceId,merchant_id:merchantId,invoice_number:invoiceNumber,currency,subtotal,tax,total,amount_paid:0,balance_due:total,status:'draft',payment_token:token,created_at:t,updated_at:t};
}

export async function recordInvoiceEvent(db:D1Database,invoiceId:string,eventType:string,metadata:unknown={}){
  await db.prepare('INSERT INTO pay_invoice_events (id,invoice_id,event_type,metadata_json,created_at) VALUES (?,?,?,?,?)').bind(id('ieve'),invoiceId,eventType,json(metadata),now()).run();
}

export async function setInvoiceStatus(db:D1Database,invoiceId:string,status:InvoiceStatus){
  const invoice=await db.prepare('SELECT id,status FROM pay_invoices WHERE id=?').bind(invoiceId).first<any>();
  if(!invoice) throw new Error('invoice_not_found');
  if(invoice.status==='paid'||invoice.status==='void') throw new Error('invoice_terminal');
  await db.prepare('UPDATE pay_invoices SET status=?,issued_at=CASE WHEN ?=\'sent\' AND issued_at IS NULL THEN ? ELSE issued_at END,updated_at=? WHERE id=?').bind(status,status,now(),now(),invoiceId).run();
  await recordInvoiceEvent(db,invoiceId,`invoice.${status}`,{});
}

export async function recordInvoicePayment(db:D1Database,invoiceId:string,amount:number,paymentId:string){
  const invoice=await db.prepare('SELECT * FROM pay_invoices WHERE id=?').bind(invoiceId).first<any>();
  if(!invoice) throw new Error('invoice_not_found');
  if(invoice.status==='void') throw new Error('invoice_void');
  const existing=await db.prepare("SELECT id FROM pay_invoice_events WHERE invoice_id=? AND event_type='invoice.payment_recorded' AND json_extract(metadata_json,'$.payment_id')=? LIMIT 1").bind(invoiceId,paymentId).first();
  if(existing) return invoice;
  const applied=Math.min(Math.max(0,Number(amount)),Math.max(0,Number(invoice.balance_due)));
  const paid=Math.round((Number(invoice.amount_paid)+applied)*100)/100;
  const balance=Math.max(0,Math.round((Number(invoice.total)-paid)*100)/100);
  const status:InvoiceStatus=balance===0?'paid':paid>0?'partially_paid':invoice.status;
  await db.prepare('UPDATE pay_invoices SET amount_paid=?,balance_due=?,status=?,paid_at=?,updated_at=? WHERE id=?').bind(paid,balance,status,status==='paid'?now():invoice.paid_at,now(),invoiceId).run();
  await recordInvoiceEvent(db,invoiceId,'invoice.payment_recorded',{payment_id:paymentId,amount:applied,balance_due:balance});
  return {amount_paid:paid,balance_due:balance,status};
}

export function renderInvoice(title:string,invoice:any,customer:any,items:any[]){
  const esc=(v:unknown)=>clean(v,2000).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const rows=items.map(i=>`<tr><td>${esc(i.description)}</td><td>${Number(i.quantity).toLocaleString('en-ZA')}</td><td>${Number(i.unit_amount).toLocaleString('en-ZA',{minimumFractionDigits:2})}</td><td>${Number(i.line_total).toLocaleString('en-ZA',{minimumFractionDigits:2})}</td></tr>`).join('');
  return `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title||'Invoice')} · IZAKHONO PAY</title><style>body{margin:0;background:#070914;color:#fff;font:16px system-ui}.box{max-width:760px;margin:5vh auto;padding:28px;background:#12162b;border:1px solid #292f4c;border-radius:24px}.muted{color:#aab2cf}.brand{font-weight:900;letter-spacing:.08em}.brand span{color:#63e6ff}table{width:100%;border-collapse:collapse;margin:24px 0}td{padding:12px 6px;border-bottom:1px solid #292f4c;text-align:left}.total{font-size:30px;font-weight:900;text-align:right}.btn{display:block;text-align:center;text-decoration:none;padding:15px;border-radius:13px;background:linear-gradient(110deg,#63e6ff,#8b8cff);color:#07101a;font-weight:900}.legal{font-size:12px;color:#8992af;margin-top:20px}</style><body><div class="box"><div class="brand">IZAKHONO <span>PAY™</span></div><h1>${esc(title||'Invoice')}</h1><p class="muted">Invoice ${esc(invoice.invoice_number)} · ${esc(customer?.name||'Customer')}</p><table><thead><tr><td>Description</td><td>Qty</td><td>Unit</td><td>Total</td></tr></thead><tbody>${rows}</tbody></table><p>Subtotal: ${esc(invoice.currency)} ${Number(invoice.subtotal).toLocaleString('en-ZA',{minimumFractionDigits:2})}</p><p>Tax: ${esc(invoice.currency)} ${Number(invoice.tax).toLocaleString('en-ZA',{minimumFractionDigits:2})}</p><div class="total">${esc(invoice.currency)} ${Number(invoice.balance_due).toLocaleString('en-ZA',{minimumFractionDigits:2})} due</div><a class="btn" href="/v1/public/invoices/${esc(invoice.payment_token)}/intent">Create payment intent</a><div class="legal">Controlled pilot invoice payment page. Live processing requires an approved provider adapter, merchant verification and applicable regulatory controls.</div></div></body></html>`;
}
