export const PROTECTIVE_LOCK_NOTICE = {
  title: 'CONNECTA SAFETY LOCK — ACTION REQUIRED',
  body:
    'Your CONNECTA account has been temporarily restricted following a safety report or high-confidence safety signal. ' +
    'You may not contact the reporting person or use another account to evade this restriction. Evidence relevant to the safety case may be preserved. ' +
    'The restriction will be reviewed urgently. A false or malicious report is itself a serious standards violation. You may appeal through CONNECTA safety review.',
};

export const FORMAL_VIOLATION_WARNING = {
  title: 'FORMAL CONNECTA SAFETY & LEGAL COMPLIANCE WARNING',
  body:
    'CONNECTA has disabled this account following a confirmed violation of the Community Standards. ' +
    'Do not evade the restriction by creating, cloning or using another account. Relevant records may be preserved for safety, dispute handling and lawful requests. ' +
    'Where conduct may be unlawful or creates a credible risk of harm, CONNECTA may refer or disclose information to appropriate authorities or affected persons when permitted or required by law. ' +
    'This notice is a platform enforcement decision and is not, by itself, a finding of criminal or civil liability. You may submit an appeal for independent review.',
};

export const ZERO_TOLERANCE_CATEGORIES = new Set([
  'cyberbullying',
  'harassment',
  'threats',
  'doxxing',
  'impersonation',
  'account-cloning',
  'scam',
  'child-sexual-exploitation',
  'pornography',
  'drugs',
  'gang-recruitment',
  'violent-criminal-glorification',
]);

const CATEGORY_ALIASES = [
  ['cyberbullying', /cyber\s*bully|bullying|humiliat|pile[- ]?on/i],
  ['harassment', /harass|stalk|targeted abuse|abusive/i],
  ['threats', /threat|kill|hurt|attack|violence/i],
  ['doxxing', /dox|home address|private address|personal information/i],
  ['impersonation', /impersonat|pretend.*person|fake profile/i],
  ['account-cloning', /clone|cloned account|copy.*profile|look[- ]?alike account/i],
  ['scam', /scam|fraud|phishing|fake payment/i],
  ['child-sexual-exploitation', /child sexual|minor sexual|groom/i],
  ['pornography', /porn|explicit sexual/i],
  ['drugs', /drug|cocaine|heroin|meth|fentanyl/i],
  ['gang-recruitment', /gang recruit|join.*gang/i],
  ['violent-criminal-glorification', /criminal glorification|celebrate.*violence/i],
];

export function normalizeSafetyCategory(reason) {
  const text = String(reason || '').trim();
  for (const [category, rule] of CATEGORY_ALIASES) {
    if (rule.test(text)) return category;
  }
  return 'harassment';
}

export function identitySkeleton(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[@._\-\s]+/g, '')
    .replace(/[013457]/g, (char) => ({'0':'o','1':'l','3':'e','4':'a','5':'s','7':'t'}[char] || char))
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 120);
}

export function similarity(a, b) {
  const left = identitySkeleton(a);
  const right = identitySkeleton(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const max = Math.max(left.length, right.length);
  if (!max) return 1;

  const prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const old = prev[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + cost);
      last = old;
    }
  }
  return Math.max(0, 1 - prev[right.length] / max);
}
