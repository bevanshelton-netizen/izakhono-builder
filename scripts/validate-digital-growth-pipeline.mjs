import fs from "node:fs";

const pipeline=JSON.parse(fs.readFileSync("products/izakhono-fabric/website-pipeline/portfolio-website-pipeline.json","utf8"));
const marketing=JSON.parse(fs.readFileSync("apps/izakhono-create/portfolio-marketing-registry.json","utf8"));
const launch=JSON.parse(fs.readFileSync("products/izakhono-ads/portfolio-launch-policy.json","utf8"));

const errors=[];
const assert=(v,m)=>{if(!v)errors.push(m)};

assert(pipeline.global_rules?.owned_infrastructure_first===true,"Pipeline must remain owned-first.");
assert(pipeline.global_rules?.no_behavioural_tracking===true,"Behavioural tracking must remain prohibited.");
assert(pipeline.global_rules?.no_advertising_ids===true,"Advertising IDs must remain prohibited.");
assert(pipeline.global_rules?.no_utm_or_referral_attribution===true,"UTM/referral attribution must remain prohibited.");
assert(pipeline.global_rules?.verified_https_required===true,"Verified HTTPS must remain required.");
assert(Array.isArray(pipeline.departments)&&pipeline.departments.length===5,"Pipeline must retain five permanent departments.");
assert(marketing.website_pipeline==="products/izakhono-fabric/website-pipeline/portfolio-website-pipeline.json","Marketing registry must point to website pipeline.");
assert(!marketing.required_fields?.includes("attribution"),"Marketing packages must not require attribution.");
assert(/no behavioural surveillance/i.test(marketing.measurement_rule||""),"Marketing measurement must remain privacy-preserving.");
assert(launch.website_pipeline==="products/izakhono-fabric/website-pipeline/portfolio-website-pipeline.json","Launch policy must point to website pipeline.");
assert(!(launch.advertising_software||[]).some(x=>/utm|attribution/i.test(x)),"Launch policy must not require UTM/attribution tooling.");
assert(launch.infrastructure?.live_requires_independent_https_verification===true,"Launch policy must require independent HTTPS verification.");

if(errors.length){
  console.error("IZAKHONO Digital Growth Pipeline validation FAILED");
  for(const e of errors) console.error("- "+e);
  process.exit(1);
}
console.log("IZAKHONO Digital Growth Pipeline validation PASSED");
console.log("Departments:",pipeline.departments.map(x=>x.name).join(" -> "));
