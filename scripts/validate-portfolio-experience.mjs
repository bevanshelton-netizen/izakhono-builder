import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const manifestPath=path.join(root,"products/izakhono-fabric/experience/portfolio-brand-manifest.json");
const rolloutPath=path.join(root,"apps/izakhono-create/portfolio-makeover-registry.json");
const errors=[];

function readJSON(p){return JSON.parse(fs.readFileSync(p,"utf8"))}
function assert(cond,msg){if(!cond)errors.push(msg)}

const brands=readJSON(manifestPath);
const rollout=readJSON(rolloutPath);
const ids=new Set((brands.platforms||[]).map(x=>x.id));
assert(brands.policy?.no_behavioural_tracking===true,"Brand manifest must prohibit behavioural tracking.");
assert(brands.policy?.no_advertising_ids===true,"Brand manifest must prohibit advertising IDs.");
assert(brands.policy?.no_utm_or_referral_attribution===true,"Brand manifest must prohibit UTM/referral attribution.");
assert(Number(brands.policy?.international_quality_score)>=95,"International quality threshold must be >=95.");
assert(brands.policy?.browser_visual_review_required===true,"Browser visual review must be required.");
assert(brands.policy?.verified_https_required===true,"Verified HTTPS must be required.");

const allowed=new Set(rollout.required_states||[]);
for(const wave of rollout.waves||[]){
  assert(allowed.has(wave.state),`Invalid makeover wave state: ${wave.id} -> ${wave.state}`);
  for(const id of wave.platforms||[]){
    if(id==="webstart") continue;
    assert(ids.has(id),`Makeover registry platform lacks brand manifest: ${id}`);
  }
}

const landing=fs.readFileSync(path.join(root,"docs/PORTFOLIO-LANDING-STANDARD.md"),"utf8");
assert(!/UTM parameters|campaign tracking|referral IDs/i.test(landing),"Landing standard must not mandate attribution tracking.");

if(errors.length){
  console.error("IZAKHONO portfolio experience validation FAILED");
  for(const e of errors)console.error("- "+e);
  process.exit(1);
}
console.log(`IZAKHONO portfolio experience validation PASSED: ${ids.size} platform identities governed.`);
