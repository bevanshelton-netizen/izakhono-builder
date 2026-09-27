const base=(process.argv[2] || process.env.BUSINESS_AI_URL || "").replace(/\/$/,"");
if(!base){ console.error("Usage: node acceptance.mjs https://businessai.example.com"); process.exit(2); }

async function get(path){
  const res=await fetch(base+path,{redirect:"follow",headers:{"user-agent":"IZAKHONO-Acceptance/1.0"}});
  return {res,text:await res.text()};
}
const health=await get("/health");
if(!health.res.ok || !health.text.includes('"ok":true')) throw new Error("Health gate failed: "+health.res.status);
const root=await get("/");
if(!root.res.ok || !root.text.includes("IZAKHONO BUSINESS AI") || !root.text.includes("DECISION LAB V0.3")) throw new Error("UI identity gate failed: "+root.res.status);
if(!base.startsWith("https://")) throw new Error("Public acceptance requires HTTPS");
console.log(JSON.stringify({ok:true,base,health:health.res.status,root:root.res.status,identity:true,https:true},null,2));
