#!/usr/bin/env node
/**
 * IZAKHONO PRE-DEPLOY SECURITY GATE
 *
 * Static proof-oriented checks for AI/vibe-coded applications.
 * This does not claim an application is secure; it looks for evidence of
 * common security controls and fails on high-confidence dangerous patterns.
 *
 * Usage:
 *   node security-gate/audit.mjs [target]
 *   node security-gate/audit.mjs apps/my-app
 *
 * Exit codes:
 *   0 = no blocking findings
 *   1 = blocking findings
 *   2 = usage/configuration error
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const MAX_FILE_BYTES = 1_500_000;
const SKIP = new Set([
  '.git', 'node_modules', '.next', '.nuxt', '.svelte-kit', 'dist', 'build',
  'coverage', '.turbo', '.vercel', '.wrangler', 'vendor'
]);
const EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte',
  '.py', '.go', '.rs', '.java', '.php', '.rb', '.sql', '.json'
]);

const findings = [];
const stats = { files: 0, lines: 0, findings: 0 };

function add(severity, rule, file, line, message, evidence = '') {
  findings.push({ severity, rule, file: path.relative(root, file), line, message, evidence: evidence.trim().slice(0, 240) });
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function scanFile(file, text) {
  const lines = text.split(/\r?\n/);
  stats.files++;
  stats.lines += lines.length;

  const lower = text.toLowerCase();
  const fileLower = file.toLowerCase();

  // 01 — Browser-controlled ownership is never authoritative.
  const ownershipPatterns = [
    /(?:req|request)\s*\.\s*body\s*\.\s*(?:user_?id|owner_?id|account_?id)/i,
    /(?:body|input|payload)\s*\??\.\s*(?:user_?id|owner_?id|account_?id)/i,
    /(?:params|query)\s*\[?['"](?:user_?id|owner_?id|account_?id)['"]\]?/i
  ];
  for (const re of ownershipPatterns) {
    const match = re.exec(text);
    if (match && /(delete|update|insert|select|find|where|db\.|prisma|supabase|drizzle|mongoose|\.from\()/i.test(text)) {
      add('CRITICAL', 'OWNERSHIP-001', file, lineOf(text, match.index),
        'Request-supplied identity appears to influence a data operation. The authenticated session must decide ownership.', match[0]);
    }
  }

  // 02 — Client-controlled money/price is forbidden.
  const moneyPatterns = [
    /(?:unit_amount|amount|price|total|subtotal)\s*:\s*(?:req|request)\s*\.\s*(?:body|query)/i,
    /(?:unit_amount|amount|price|total|subtotal)\s*:\s*(?:body|payload|input)\s*\??\./i,
    /(?:amount|price)\s*=\s*await\s+(?:req|request)\s*\.\s*(?:json|body)/i
  ];
  for (const re of moneyPatterns) {
    const match = re.exec(text);
    if (match && /(stripe|payfast|ik?hokha|yoco|payment|checkout|invoice|charge)/i.test(text)) {
      add('CRITICAL', 'PAYMENT-001', file, lineOf(text, match.index),
        'Payment amount/price appears to originate from the client. Resolve price server-side from a trusted product/price ID.', match[0]);
    }
  }

  // 03 — Stripe webhooks must verify the raw payload/signature.
  if (/(stripe|webhook)/i.test(fileLower) && /(webhook|constructevent|signature)/i.test(lower)) {
    const looksLikeWebhook = /webhook/i.test(fileLower) || /stripe\.webhooks/i.test(lower);
    const verifies = /constructEvent|construct_event|webhooks\.constructEvent|signature\s*[,=]/i.test(text);
    if (looksLikeWebhook && !verifies) {
      add('CRITICAL', 'PAYMENT-002', file, 1,
        'Webhook handler detected without clear signature verification. Verify the provider signature against the raw request body before acting.');
    }
  }

  // 04 — Auth and paid API routes need rate limiting.
  const authRoute = /(login|signin|sign-in|signup|sign-up|register|password[-_ ]?reset|forgot[-_ ]?password)/i.test(fileLower);
  const paidRoute = /(checkout|billing|payment|charge|subscription|invoice|paid|openai|anthropic|ai\/|api\/chat)/i.test(fileLower);
  const limiter = /(rate.?limit|ratelimit|throttle|sliding.?window|token.?bucket|fixed.?window)/i.test(text);
  if ((authRoute || paidRoute) && !limiter) {
    add('HIGH', authRoute ? 'RATE-001' : 'RATE-002', file, 1,
      authRoute
        ? 'Authentication route has no visible rate-limiting control.'
        : 'Potential paid/API-cost route has no visible rate-limiting control.');
  }

  // 05 — Obvious secret exposure in browser bundles.
  const publicSecret = /(NEXT_PUBLIC|VITE|PUBLIC_|NUXT_PUBLIC)_[A-Z0-9_]*(SECRET|PRIVATE_KEY|TOKEN|PASSWORD|API_KEY)/i;
  const secretMatch = publicSecret.exec(text);
  if (secretMatch) {
    add('CRITICAL', 'SECRETS-001', file, lineOf(text, secretMatch.index),
      'A variable name suggests a secret is exposed through a public/browser environment variable.', secretMatch[0]);
  }

  // 06 — Unsafe eval/shell patterns are at least review-required.
  const dangerous = /\b(eval\s*\(|new\s+Function\s*\(|child_process\.(?:exec|execSync)\s*\(|os\.system\s*\()/i;
  const dangerousMatch = dangerous.exec(text);
  if (dangerousMatch && !/security-gate|test|fixture|example/i.test(fileLower)) {
    add('HIGH', 'EXEC-001', file, lineOf(text, dangerousMatch.index),
      'Dynamic code or shell execution detected. Confirm the input cannot be attacker-controlled and prefer allowlisted arguments.', dangerousMatch[0]);
  }
}

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (err) { console.error(`Cannot read ${dir}: ${err.message}`); process.exit(2); }

  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      try {
        const stat = fs.statSync(full);
        if (stat.size <= MAX_FILE_BYTES) scanFile(full, fs.readFileSync(full, 'utf8'));
      } catch (err) {
        add('HIGH', 'SCAN-001', full, 1, `Could not inspect file: ${err.message}`);
      }
    }
  }
}

if (!fs.existsSync(root)) {
  console.error(`Target does not exist: ${root}`);
  process.exit(2);
}

walk(root);

const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);
stats.findings = findings.length;

console.log('\nIZAKHONO SECURITY GATE');
console.log('=======================');
console.log(`Target: ${root}`);
console.log(`Files scanned: ${stats.files}`);
console.log(`Lines scanned: ${stats.lines}`);
console.log(`Findings: ${stats.findings}`);

if (!findings.length) {
  console.log('\nPASS — no blocking static findings detected.');
  console.log('NOTE — this is not proof of security. Adversarial tests must still pass before production.');
  process.exit(0);
}

for (const f of findings) {
  console.log(`\n[${f.severity}] ${f.rule} ${f.file}:${f.line}`);
  console.log(`  ${f.message}`);
  if (f.evidence) console.log(`  Evidence: ${f.evidence}`);
}

const blocking = findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
console.log(`\n${blocking.length ? 'BLOCK' : 'REVIEW'} — ${blocking.length} blocking finding(s).`);
console.log('Do not deploy until the finding is fixed or explicitly waived with documented evidence.');
process.exit(blocking.length ? 1 : 0);
