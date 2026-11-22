const fs = require('node:fs');
const path = require('node:path');

const cataloguePath = path.join(__dirname, '..', 'partners', 'service-catalogue.json');
const source = JSON.parse(fs.readFileSync(cataloguePath, 'utf8'));

function publicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    deliveryModels: [...product.delivery],
    pricingModel: product.pricingModel,
    networkSelection: Boolean(product.networkSelection),
    availability: 'NOT_VERIFIED',
    commercialStatus: 'PARTNER_ASSESSMENT_REQUIRED',
    orderable: false,
    price: null,
    currency: 'ZAR',
    disclosure: 'Indicative catalogue entry only. Price, coverage, serviceability, contract terms and fulfilment have not been verified for this request.'
  };
}

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  return res.status(200).json({
    service: 'I-CONNECT Catalogue',
    schemaVersion: source.schemaVersion,
    market: 'ZA',
    status: 'DISCOVERY_CATALOGUE',
    orderable: false,
    products: source.products.map(publicProduct)
  });
};
