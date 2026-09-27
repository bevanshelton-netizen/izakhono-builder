import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const esc = (v="") => String(v)
  .replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;")
  .replaceAll("'","&#39;");

function assertHex(v, fallback) {
  return /^#[0-9a-f]{6}$/i.test(v || "") ? v : fallback;
}

export function validateBrief(brief) {
  const errors = [];
  for (const key of ["business_name","offer","primary_cta"]) {
    if (!String(brief?.[key] || "").trim()) errors.push(`Missing required field: ${key}`);
  }
  if (brief?.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brief.contact_email)) {
    errors.push("contact_email is not valid");
  }
  if (brief?.brand) {
    for (const key of ["primary","secondary","accent"]) {
      if (brief.brand[key] && !/^#[0-9a-f]{6}$/i.test(brief.brand[key])) errors.push(`brand.${key} must be a 6-digit hex colour`);
    }
  }
  return errors;
}

export function buildPreview(brief) {
  const started = performance.now();
  const errors = validateBrief(brief);
  if (errors.length) return { ok:false, errors, publish_candidate:false };

  const primary = assertHex(brief.brand?.primary, "#07110e");
  const secondary = assertHex(brief.brand?.secondary, "#12372a");
  const accent = assertHex(brief.brand?.accent, "#d9bd78");
  const contactAvailable = Boolean(brief.contact_email || brief.contact_phone);
  const criticalUnknowns = [];
  if (!brief.contact_email && !brief.contact_phone) criticalUnknowns.push("contact route");
  if (!brief.legal_entity) criticalUnknowns.push("legal entity");
  const services = Array.isArray(brief.services) ? brief.services.slice(0,12) : [];
  const claims = Array.isArray(brief.verified_claims) ? brief.verified_claims.slice(0,20) : [];

  const serviceHtml = services.length
    ? services.map((s,i)=>`<article class="card"><small>${String(i+1).padStart(2,"0")}</small><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></article>`).join("")
    : `<article class="card muted"><small>INFO</small><h3>Services to confirm</h3><p>This private preview does not invent services. Add verified service details to complete the site.</p></article>`;

  const claimHtml = claims.length
    ? `<div class="claims">${claims.map(c=>`<span>${esc(c)}</span>`).join("")}</div>`
    : "";

  const contactLine = brief.contact_email
    ? `<a href="mailto:${esc(brief.contact_email)}">${esc(brief.contact_email)}</a>`
    : brief.contact_phone
      ? `<a href="tel:${esc(brief.contact_phone)}">${esc(brief.contact_phone)}</a>`
      : `<span class="needs">Contact details required before publishing.</span>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="description" content="${esc(brief.offer.slice(0,155))}">
<title>${esc(brief.business_name)}</title>
<style>
:root{--p:${primary};--s:${secondary};--a:${accent};--paper:#f5f3ec;--ink:#101713;--muted:#66716a;--shell:min(1180px,calc(100% - 36px))}
*{box-sizing:border-box}body{margin:0;background:var(--p);color:white;font:16px/1.6 Inter,system-ui,sans-serif}a{color:inherit;text-decoration:none}
header{border-bottom:1px solid #ffffff20}.nav{width:var(--shell);margin:auto;min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.brand{font-weight:900;letter-spacing:.02em}.cta{background:var(--a);color:#111;padding:12px 18px;border-radius:999px;font-weight:900}
.hero{width:var(--shell);margin:auto;padding:90px 0 72px;display:grid;grid-template-columns:1.15fr .85fr;gap:50px;align-items:center}
.hero h1{font:500 clamp(3.6rem,8vw,7.2rem)/.9 Georgia,serif;margin:12px 0 26px;letter-spacing:-.05em}.hero p{color:#d5ddd8;font-size:1.16rem;max-width:720px}.eyebrow{color:var(--a);font-size:11px;letter-spacing:.18em;font-weight:900;text-transform:uppercase}
.visual{min-height:430px;border:1px solid #ffffff22;border-radius:32px;background:radial-gradient(circle at 70% 25%,#ffffff14,transparent 28%),linear-gradient(135deg,var(--s),var(--p));display:grid;place-items:center;overflow:hidden}
.visual:before{content:"";width:220px;height:220px;border:1px solid var(--a);transform:rotate(45deg);border-radius:30px}.claims{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}.claims span{border:1px solid #ffffff25;padding:7px 10px;border-radius:999px;font-size:12px}
section{padding:84px 0}.paper{background:var(--paper);color:var(--ink)}.inner{width:var(--shell);margin:auto}.inner h2{font:500 clamp(2.7rem,5vw,5rem)/.95 Georgia,serif;letter-spacing:-.04em}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{background:white;border-radius:22px;padding:24px;min-height:220px;box-shadow:0 16px 42px #15201912}.card small{color:#8a7438;font-weight:900}.card h3{font-size:1.25rem;margin:35px 0 10px}.card p{color:var(--muted)}.card.muted{border:1px dashed #9ba79f}
.contact{width:var(--shell);margin:auto;padding:76px 0}.contact h2{font:500 clamp(2.8rem,5vw,4.8rem)/.95 Georgia,serif;margin:0 0 20px}.contact a{color:var(--a);font-weight:900}.needs{color:#f0c18c}
footer{border-top:1px solid #ffffff20}.foot{width:var(--shell);margin:auto;padding:24px 0;color:#aab7b0;font-size:12px}
@media(max-width:860px){.hero{grid-template-columns:1fr}.visual{min-height:280px}.cards{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.hero{padding:60px 0 50px}.hero h1{font-size:clamp(3rem,16vw,5rem)}.cards{grid-template-columns:1fr}.nav .cta{display:none}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
</style>
</head>
<body>
<header><div class="nav"><div class="brand">${esc(brief.business_name)}</div><a class="cta" href="#contact">${esc(brief.primary_cta)}</a></div></header>
<main>
<section class="hero"><div><div class="eyebrow">${esc(brief.location || "Professional business")}</div><h1>${esc(brief.tagline || brief.business_name)}</h1><p>${esc(brief.offer)}</p>${claimHtml}</div><div class="visual" aria-hidden="true"></div></section>
<section class="paper"><div class="inner"><div class="eyebrow">What we offer</div><h2>Built around verified facts.</h2><div class="cards">${serviceHtml}</div></div></section>
<section id="contact"><div class="contact"><div class="eyebrow">Contact</div><h2>${esc(brief.primary_cta)}</h2><p>${contactLine}</p></div></section>
</main>
<footer><div class="foot">${esc(brief.legal_entity || brief.business_name)}${brief.registration_number ? " · "+esc(brief.registration_number) : ""}</div></footer>
</body></html>`;

  const qaChecks = [
    ["required_fields", errors.length===0],
    ["no_tracking", !/analytics|pixel|gtag|facebook|utm_/i.test(html)],
    ["responsive_viewport", html.includes('name="viewport"')],
    ["primary_cta", html.includes(esc(brief.primary_cta))],
    ["exact_business_name", html.includes(esc(brief.business_name))],
    ["contact_route", contactAvailable],
    ["no_public_indexing_before_gate", html.includes('noindex,nofollow')],
    ["legal_entity_known", Boolean(brief.legal_entity)]
  ];
  const passed = qaChecks.filter(([,ok])=>ok).length;
  const score = Math.round((passed/qaChecks.length)*100);
  const publish_candidate = criticalUnknowns.length===0 && score===100;

  return {
    ok:true,
    html,
    qa:{
      score,
      checks:Object.fromEntries(qaChecks),
      critical_unknowns:criticalUnknowns,
      publish_candidate
    },
    timing_ms:{total:Math.round((performance.now()-started)*100)/100}
  };
}

async function main(){
  const inputPath = process.argv[2];
  const outDir = process.argv[3] || "./fast-build-output";
  if(!inputPath){
    console.error("Usage: node fast-build.mjs <brief.json> [output-dir]");
    process.exit(2);
  }
  const brief=JSON.parse(fs.readFileSync(inputPath,"utf8"));
  const result=buildPreview(brief);
  if(!result.ok){
    console.error(JSON.stringify(result,null,2));
    process.exit(1);
  }
  fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,"index.html"),result.html);
  fs.writeFileSync(path.join(outDir,"qa.json"),JSON.stringify(result.qa,null,2)+"\n");
  fs.writeFileSync(path.join(outDir,"build.json"),JSON.stringify({timing_ms:result.timing_ms,publish_candidate:result.qa.publish_candidate},null,2)+"\n");
  process.stdout.write(JSON.stringify({output:outDir,qa:result.qa,timing_ms:result.timing_ms},null,2)+"\n");
}

if(process.argv[1]===fileURLToPath(import.meta.url)) await main();
