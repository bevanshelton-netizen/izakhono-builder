import fs from "node:fs";

function read(path){ return fs.readFileSync(path,"utf8"); }
function requireAll(label,text,items){
  const missing=items.filter(x=>!text.includes(x));
  if(missing.length) throw new Error(label+" missing: "+missing.join(", "));
}
function requireAny(label,text,items){
  if(!items.some(x=>text.includes(x))) throw new Error(label+" missing accepted variant: "+items.join(" | "));
}

const sovereign=read("src/sovereign.ts");
const core=read("src/index.ts");
const ui=read("public/index.html");
const registry=read("products/izakhono-super-app/public/module-registry.json");
const superWorker=read("products/izakhono-super-app/src/index.ts");

requireAll("sovereign",sovereign,[
  "async function buildAnythingRoute",
  "async function enrichBuildIntentWithSuperAI",
  "IZAKHONO_SUPER_AI_WORKFLOW_KEY",
  "product: 'izakhono-builder'",
  "capability: 'reasoning'",
  "/api/build-anything",
  "/autopilot",
  "release_candidate:",
  "public_live: false",
  "owned-runtime-deployment-verification"
]);
requireAll("core modules",core,[
  "game: { label: 'Game Engine'",
  "seo: { label: 'SEO & Discovery'",
  "browser-first game runtime shell",
  "search/discovery foundation"
]);
requireAll("owner UI",ui,[
  'id="buildAnything"',
  'id="quickPrompt"',
  'id="quickTarget"',
  "async function buildAnything()",
  "/api/build-anything"
]);
requireAny("owner UI build-mode label",ui,[
  "IZAKHONO BUILD ANYTHING",
  "IZAKHONO BUILDER · FAST BUILD MODE"
]);
requireAny("owner UI release-candidate confirmation",ui,[
  "Release candidate created and committed to IZAKHONO.",
  "Controlled release candidate created."
]);
requireAll("SUPER APP registry",registry,[
  '"id": "builder"',
  '"name": "IZAKHONO BUILDER AI"',
  '"route": "/builder"',
  '"engine": "independent"'
]);
requireAll("SUPER APP worker",superWorker,[
  'id:"builder"',
  'name:"IZAKHONO BUILDER AI"',
  'route:"/builder"'
]);

if(/public_live:\s*true/.test(sovereign)){
  throw new Error("Build Anything must not claim public live without deployment evidence.");
}

console.log("[PASS] IZAKHONO BUILD ANYTHING v1 owner/AI/autopilot/SUPER APP contract is intact.");
