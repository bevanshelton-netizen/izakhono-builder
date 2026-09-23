export type ModerationCategory =
  | 'cyberbullying'
  | 'threats'
  | 'doxxing'
  | 'drugs'
  | 'pornography'
  | 'child-sexual-exploitation'
  | 'gang-recruitment'
  | 'violent-criminal-glorification';

export type ModerationDecision = {
  action: 'allow' | 'review' | 'block';
  categories: ModerationCategory[];
  reason: string;
};

const HARD_BLOCKS: Array<[ModerationCategory, RegExp[]]> = [
  ['cyberbullying', [
    /\b(kill yourself|go kill yourself|kys|you should die|hope you die)\b/i,
    /\b(everyone|everybody|all of you)\b.{0,35}\b(harass|bully|attack|humiliate|shame)\b/i,
    /\b(harass|bully|attack|humiliate|shame)\b.{0,35}\b(@[a-z0-9._-]+|this person|him|her|them)\b/i,
  ]],
  ['threats', [
    /\b(i will|i'm going to|we will|we're going to)\b.{0,30}\b(kill|hurt|beat|attack|shoot|stab)\b/i,
    /\b(coming for you|watch your back|you are dead)\b/i,
  ]],
  ['doxxing', [
    /\b(here is|their|his|her)\b.{0,30}\b(home address|private address|phone number)\b/i,
    /\b(dox|doxx|doxxing)\b.{0,30}\b(@[a-z0-9._-]+|him|her|them|this person)\b/i,
  ]],
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

const PUBLIC_INTEREST = /\b(news|journalism|research|education|awareness|prevention|recovery|rehab|police|court|documentary|reporting|history)\b/i;

export function moderateText(input: string): ModerationDecision {
  const text = input.trim();
  if (!text) return { action: 'allow', categories: [], reason: 'No content supplied.' };

  const matched: ModerationCategory[] = [];
  for (const [category, rules] of HARD_BLOCKS) {
    if (rules.some((rule) => rule.test(text))) matched.push(category);
  }

  if (!matched.length) {
    return { action: 'allow', categories: [], reason: 'No prohibited-content signal detected by the baseline filter.' };
  }

  if (matched.includes('child-sexual-exploitation')) {
    return {
      action: 'block',
      categories: matched,
      reason: 'Sexual exploitation or sexual content involving minors is prohibited and triggers zero-tolerance enforcement.',
    };
  }

  if (PUBLIC_INTEREST.test(text)) {
    return {
      action: 'review',
      categories: matched,
      reason: 'Potentially prohibited subject matter appears in a public-interest context and needs contextual review.',
    };
  }

  return {
    action: 'block',
    categories: matched,
    reason: 'This content matches a zero-tolerance CONNECTA safety category and will not be published.',
  };
}
