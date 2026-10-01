-- IZAKHONO HOST Customer #001 bootstrap.
-- This records known provisioning state only; it does not claim external domain attachment, email activation or payment clearance.

INSERT OR IGNORE INTO host_customers
(id,legal_name,trading_name,registration_number,primary_contact,email,phone,status)
VALUES
('cus_xqwaxqwamile_001','!XQWAXQWAMILÉ HOLDINGS (PTY) LTD','!XQWAXQWAMILÉ HOLDINGS','2017/315075/07','','','active');

INSERT OR IGNORE INTO host_domains
(id,customer_id,domain,registrar,registrar_status,expires_at,auto_renew,dns_provider,dns_status,verification_status)
VALUES
('dom_xqwaxqwamile_001','cus_xqwaxqwamile_001','xqwaxqwamile.com','Cloudflare','active','2027-10-01',1,'Cloudflare','configured','pending');

INSERT OR IGNORE INTO host_sites
(id,customer_id,domain_id,name,deployment_provider,provider_project_id,deployment_url,status,ssl_status,canonical_host)
VALUES
('site_xqwaxqwamile_001','cus_xqwaxqwamile_001','dom_xqwaxqwamile_001','xqwaxqwamile.com','vercel','prj_2G8Tyz2bIbvSW6sKhcJJx1LPWfoA','https://xqwaxqwamile-holdings-1yeyho8pt-bevan2.vercel.app','planned','pending','xqwaxqwamile.com');

INSERT OR IGNORE INTO host_dns_records
(id,domain_id,record_type,name,content,ttl,proxied,status)
VALUES
('dns_xqwaxqwamile_a','dom_xqwaxqwamile_001','A','@','76.76.21.21',1,0,'configured'),
('dns_xqwaxqwamile_www','dom_xqwaxqwamile_001','CNAME','www','cname.vercel-dns.com',1,0,'configured');

INSERT OR IGNORE INTO host_subscriptions
(id,customer_id,plan_id,status,started_at,renews_at)
VALUES
('sub_xqwaxqwamile_001','cus_xqwaxqwamile_001','plan_business','pending',NULL,NULL);

INSERT OR IGNORE INTO host_invoices
(id,customer_id,invoice_number,amount_cents,currency,status)
VALUES
('inv_xqwaxqwamile_001','cus_xqwaxqwamile_001','IZH-XQ-20260927-001',54800,'ZAR','unpaid');

INSERT OR IGNORE INTO host_mailboxes
(id,customer_id,domain_id,address,provider,status)
VALUES
('mb_xqwaxqwamile_info','cus_xqwaxqwamile_001','dom_xqwaxqwamile_001','info@xqwaxqwamile.com','izakhono-mail','planned'),
('mb_xqwaxqwamile_calvin','cus_xqwaxqwamile_001','dom_xqwaxqwamile_001','calvin@xqwaxqwamile.com','izakhono-mail','planned'),
('mb_xqwaxqwamile_projects','cus_xqwaxqwamile_001','dom_xqwaxqwamile_001','projects@xqwaxqwamile.com','izakhono-mail','planned'),
('mb_xqwaxqwamile_diamonds','cus_xqwaxqwamile_001','dom_xqwaxqwamile_001','diamonds@xqwaxqwamile.com','izakhono-mail','planned'),
('mb_xqwaxqwamile_tenders','cus_xqwaxqwamile_001','dom_xqwaxqwamile_001','tenders@xqwaxqwamile.com','izakhono-mail','planned');

INSERT OR IGNORE INTO host_jobs
(id,customer_id,job_type,target_id,provider,status,input_json)
VALUES
('job_xqwaxqwamile_dns','cus_xqwaxqwamile_001','dns_apply','dom_xqwaxqwamile_001','cloudflare','verified','{"records_configured":2}'),
('job_xqwaxqwamile_site','cus_xqwaxqwamile_001','site_provision','site_xqwaxqwamile_001','vercel','running','{"deployment":"READY","custom_domain":"pending"}'),
('job_xqwaxqwamile_ssl','cus_xqwaxqwamile_001','ssl_verify','site_xqwaxqwamile_001','vercel','queued','{}'),
('job_xqwaxqwamile_mail','cus_xqwaxqwamile_001','mailbox_provision','dom_xqwaxqwamile_001','izakhono-mail','queued','{"mailboxes":5}');

INSERT OR IGNORE INTO host_audit_events
(id,customer_id,event_type,actor,detail_json)
VALUES
('evt_xqwaxqwamile_bootstrap','cus_xqwaxqwamile_001','customer.bootstrap','system','{"source":"IZAKHONO HOST v0.1","evidence_gates":["payment clearance","custom-domain attachment","SSL verification","mail provider activation"]}');
