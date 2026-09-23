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
