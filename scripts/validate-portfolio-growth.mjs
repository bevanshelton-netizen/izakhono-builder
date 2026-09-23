import fs from 'node:fs';

const marketingPath = 'apps/izakhono-create/portfolio-marketing-registry.json';
const growthPath = 'apps/izakhono-create/portfolio-growth-registry.json';
const seedPath = 'migrations/0003_seed_active_portfolio.sql';
const adsGrowthPath = 'products/izakhono-ads/portfolio-growth-registry.json';

const marketing = JSON.parse(fs.readFileSync(marketingPath, 'utf8'));
const growth = JSON.parse(fs.readFileSync(growthPath, 'utf8'));
const adsGrowth = JSON.parse(fs.readFileSync(adsGrowthPath, 'utf8'));
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
  behavioural_surveillance:false
}, null, 2));
