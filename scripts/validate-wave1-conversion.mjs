import fs from 'node:fs';

const createPath = 'apps/izakhono-create/wave1-conversion-registry.json';
const adsPath = 'products/izakhono-ads/wave1-conversion-registry.json';

const create = JSON.parse(fs.readFileSync(createPath, 'utf8'));
const ads = JSON.parse(fs.readFileSync(adsPath, 'utf8'));

const errors = [];

if (JSON.stringify(create) !== JSON.stringify(ads)) {
  errors.push('CREATE and ADS Wave 1 conversion registries have drifted');
}

if (create.schema !== 'izakhono.wave1.conversion.v1') {
  errors.push('unexpected Wave 1 conversion schema');
}

const required = [
  'slug','display_name','public_url','primary_cta','revenue_route','share_route',
  'public_https','primary_cta_status','revenue_route_status','share_route_status',
  'conversion_status','evidence_notes'
];

for (const product of create.products || []) {
  for (const field of required) {
    if (product[field] === undefined || product[field] === null || product[field] === '') {
      errors.push(`${product.slug || '<unknown>'}: missing ${field}`);
    }
  }

  if (!String(product.public_url || '').startsWith('https://')) {
    errors.push(`${product.slug}: public_url must use HTTPS`);
  }

  if (product.conversion_status === 'VERIFIED_CONVERSION_READY') {
    if (product.public_https !== 'VERIFIED') {
      errors.push(`${product.slug}: conversion-ready without verified public HTTPS`);
    }
    if (!String(product.primary_cta_status).startsWith('VERIFIED')) {
      errors.push(`${product.slug}: conversion-ready without verified primary CTA`);
    }
    if (product.revenue_route_status !== 'VERIFIED') {
      errors.push(`${product.slug}: conversion-ready without verified revenue route`);
    }
  }

  if (!Array.isArray(product.evidence_notes) || product.evidence_notes.length === 0) {
    errors.push(`${product.slug}: evidence_notes required`);
  }
}

const slugs = new Set((create.products || []).map(p => p.slug));
for (const slug of ['faisready','edu-build-institute','izakhono-clothing']) {
  if (!slugs.has(slug)) errors.push(`Wave 1 product missing: ${slug}`);
}

if (errors.length) {
  console.error('Wave 1 conversion validation failed:');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log(JSON.stringify({
  ok:true,
  products:create.products.length,
  verified_conversion_ready:create.products.filter(p => p.conversion_status === 'VERIFIED_CONVERSION_READY').length,
  blocked:create.products.filter(p => p.conversion_status !== 'VERIFIED_CONVERSION_READY').length
}, null, 2));
