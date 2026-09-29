import fs from 'node:fs';

const sovereign=fs.readFileSync('src/sovereign.ts','utf8');
const html=fs.readFileSync('public/growth-check/index.html','utf8');
const app=fs.readFileSync('public/growth-check/app.js','utf8');
const migration=fs.readFileSync('migrations/0007_growth_diagnostic_leads.sql','utf8');

const required=[
  [sovereign,"/api/public/growth-diagnostic"],
  [sovereign,"/api/public/growth-diagnostic/lead"],
  [sovereign,"/api/owner/growth-diagnostic/leads"],
  [sovereign,"growth_diagnostic_leads"],
  [sovereign,"behavioural_tracking: false"],
  [sovereign,"contact consent is required"],
  [html,"3-MINUTE BUSINESS GROWTH CHECK"],
  [html,"NO TRACKING COOKIES"],
  [app,"/api/public/growth-diagnostic"],
  [app,"/api/public/growth-diagnostic/lead"],
  [migration,"CREATE TABLE IF NOT EXISTS growth_diagnostic_leads"],
  [migration,"CHECK (consent = 1)"],
];
const missing=required.filter(([text,needle])=>!text.includes(needle)).map(([,needle])=>needle);
if(missing.length) throw new Error('Growth Check edge contract missing: '+missing.join(', '));
console.log('[PASS] Growth Check public edge, privacy controls, lead queue and owner lead view are present.');
