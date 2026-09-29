import fs from "node:fs";
const root=new URL("./",import.meta.url);
const html=fs.readFileSync(new URL("index.html",root),"utf8");
const worker=fs.readFileSync(new URL("external-worker.js",root),"utf8");
for(const marker of ["SAQA 97542","131 credits","30 Dec 2026","edubuildshelton.org.za/form/","info@edubuildshelton.org.za"]){
  if(!html.includes(marker)) throw new Error("Missing marker: "+marker);
}
for(const obsolete of ["Level 4 Certificate (140 Credits)","ECD Level 4 Certificate (140 Credits)"]){
  if(html.includes(obsolete)) throw new Error("Obsolete Level 4 wording found");
}
for(const guard of ["tracking: false","learner_writes: false","payment_writes: false"]){
  if(!worker.includes(guard)) throw new Error("Missing boundary: "+guard);
}
console.log("EDUBUILD_PUBLIC_VERIFY=PASS");
