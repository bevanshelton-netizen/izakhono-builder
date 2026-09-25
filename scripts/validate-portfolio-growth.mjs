import fs from 'node:fs';

const marketingPath = 'apps/izakhono-create/portfolio-marketing-registry.json';
const growthPath = 'apps/izakhono-create/portfolio-growth-registry.json';
const seedPath = 'migrations/0003_seed_active_portfolio.sql';
const adsGrowthPath = 'products/izakhono-ads/portfolio-growth-registry.json';
const launchPath = 'apps/izakhono-create/portfolio-launch-policy.json';
const adsLaunchPath = 'products/izakhono-ads/portfolio-launch-policy.json';

const marketing = JSON.parse(fs.readFileSync(marketingPath, 'utf8'));
const growth = JSON.parse(fs.readFileSync(growthPath, 'utf8'));
const adsGrowth = JSON.parse(fs.readFileSync(adsGrowthPath, 'utf8'));
const launch = JSON.parse(fs.readFileSync(launchPath, 'utf8'));
const adsLaunch = JSON.parse(fs.readFileSync(adsLaunchPath, 'utf8'));
const seed = fs.readFileSync(seedPath, 'utf8');

const requiredFields = [
  'slug','display_name','archetype','primary_audience','primary_cta',
  'activation_event','retention_loop','referral_loop','revenue_model',
  'primary_channels','partnership_targets','regulated'
];

const errors = [];
if (JSON.stringify(growth) !== JSON.stringify(adsGrowth)) {
  errors.push('IZAKHONO CREATE and IZAKHONO ADS growth registries have drifted');
}
if (JSON.stringify(launch) !== JSON.stringify(adsLaunch)) {
  errors.push('IZAKHONO CREATE and IZAKHONO ADS launch policies have drifted');
}
if (launch.schema !== 'izakhono.portfolio.launch.v1') {
  errors.push('unexpected portfolio launch policy schema');
}
if (launch.infrastructure?.chatgpt_runtime_dependency !== false) {
  errors.push('portfolio launch policy must not depend on ChatGPT runtime');
}
if (launch.infrastructure?.platform_specific_engine_required !== true) {
  errors.push('platform-specific engine requirement must remain enabled');
}
if (launch.infrastructure?.live_requires_independent_https_verification !== true) {
  errors.push('independent HTTPS verification must remain required');
}
if (launch.international_site_standard?.required !== true || (launch.international_site_standard?.requirements || []).length < 8) {
  errors.push('international professional site standard is incomplete');
}
if (launch.rollout?.ceo_strategy_required !== true) {
  errors.push('CEO rollout strategy must remain mandatory');
}
if (launch.rollout?.systems?.creative !== 'IZAKHONO CREATE') {
  errors.push('launch policy creative system must be IZAKHONO CREATE');
}
if (launch.rollout?.systems?.distribution !== 'IZAKHONO ADS') {
  errors.push('launch policy distribution system must be IZAKHONO ADS');
}
if (!(launch.advertising_software || []).includes('IZAKHONO ADS')) {
  errors.push('advertising stack must include IZAKHONO ADS');
}

const products = new Map();
for (const product of growth.products || []) {
  for (const field of requiredFields) {
    if (product[field] === undefined || product[field] === null || product[field] === '') {
      errors.push(`${product.slug || '<unknown>'}: missing ${field}`);
    }
  }
  if (!growth.archetypes?.[product.archetype]) {
    errors.push(`${product.slug}: unknown archetype ${product.archetype}`);
  }
  if (products.has(product.slug)) errors.push(`duplicate growth slug: ${product.slug}`);
  products.set(product.slug, product);
}

for (const slug of marketing.current_internal_products || []) {
  if (!products.has(slug)) errors.push(`marketing registry product missing growth strategy: ${slug}`);
}

const seedSlugs = [...seed.matchAll(/\('prj_[^']*','[^']*','([^']+)'/g)].map(m => m[1]);
for (const slug of seedSlugs) {
  if (!products.has(slug)) errors.push(`seeded portfolio product missing growth strategy: ${slug}`);
}

for (const required of ['connecta','izakhono-create','izakhono-domains']) {
  if (!products.has(required)) errors.push(`required platform missing growth strategy: ${required}`);
}

if (marketing.creative_system_of_record !== 'IZAKHONO CREATE') {
  errors.push('IZAKHONO CREATE must remain creative system of record');
}
if (marketing.distribution_system !== 'IZAKHONO ADS') {
  errors.push('IZAKHONO ADS must remain distribution system');
}
if (marketing.launch_policy !== launchPath) {
  errors.push('marketing registry must point to the canonical launch policy');
}
if (marketing.auto_rollout_when_conversion_verified !== true) {
  errors.push('verified products must enter CEO rollout automatically');
}
if (marketing.paid_spend_requires_explicit_budget_authority !== true) {
  errors.push('paid spend must remain explicitly budget-authorised');
}
if (marketing.international_site_standard_required !== true) {
  errors.push('international site standard must remain mandatory');
}
if (marketing.advertising_stack_required !== true) {
  errors.push('advertising stack must remain mandatory');
}

if (errors.length) {
  console.error('Portfolio CEO growth validation failed:');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log(JSON.stringify({
  ok:true,
  products:products.size,
  seeded_products:seedSlugs.length,
  internal_products:(marketing.current_internal_products || []).length,
  creative_system:marketing.creative_system_of_record,
  distribution_system:marketing.distribution_system,
  launch_policy:launch.schema,
  international_site_standard:true,
  ceo_rollout:true,
  advertising_stack:true,
  behavioural_surveillance:false
}, null, 2));
