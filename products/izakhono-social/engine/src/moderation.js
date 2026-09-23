const HARD_BLOCKS = [
  ['child-sexual-exploitation', [
    /child\s*(porn|sexual|nude|nudes|explicit)/i,
    /minor\s*(porn|sexual|nude|nudes|explicit)/i,
    /underage\s*(porn|sexual|nude|nudes|explicit)/i,
  ]],
  ['pornography', [
    /\b(porn|pornography|explicit sex video|sell nudes|buy nudes)\b/i,
  ]],
  ['drugs', [
    /\b(buy|sell|deliver|dealer|plug)\b.{0,28}\b(cocaine|heroin|meth|tik|ecstasy|mdma|fentanyl)\b/i,
    /\b(cocaine|heroin|meth|tik|ecstasy|mdma|fentanyl)\b.{0,28}\b(buy|sell|deliver|dealer|plug)\b/i,
  ]],
  ['gang-recruitment', [
    /\b(join|recruit|enlist)\b.{0,35}\b(gang|crew)\b/i,
    /\b(gang|crew)\b.{0,35}\b(join|recruit|enlist)\b/i,
  ]],
  ['violent-criminal-glorification', [
    /\b(glorify|celebrate|proud of)\b.{0,35}\b(murder|armed robbery|gang violence)\b/i,
  ]],
];

const PUBLIC_INTEREST =
  /\b(news|journalism|research|education|awareness|prevention|recovery|rehab|police|court|documentary|reporting|history)\b/i;

export function moderateText(input) {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) return { action: 'allow', categories: [], reason: 'No content supplied.' };

  const categories = [];
  for (const [category, rules] of HARD_BLOCKS) {
    if (rules.some((rule) => rule.test(text))) categories.push(category);
  }

  if (!categories.length) {
    return {
      action: 'allow',
      categories: [],
      reason: 'No prohibited-content signal detected by the baseline filter.',
    };
  }

  if (categories.includes('child-sexual-exploitation')) {
    return {
      action: 'block',
      categories,
      reason: 'Sexual exploitation or sexual content involving minors is prohibited.',
    };
  }

  if (PUBLIC_INTEREST.test(text)) {
    return {
      action: 'review',
      categories,
      reason: 'Restricted subject matter appears in a public-interest context and needs contextual review.',
    };
  }

  return {
    action: 'block',
    categories,
    reason: 'This content appears to promote, trade, recruit for or glorify prohibited harmful activity.',
  };
}
