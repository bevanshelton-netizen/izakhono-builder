import { DiscoverySurface } from '@/components/discovery-surface';

export default function CommercePage() {
  return <DiscoverySurface
    eyebrow="CONNECTA COMMERCE"
    title="Find businesses, products and services."
    description="A trusted commercial discovery layer for verified businesses, catalogues, partner storefronts, services, campaigns and customer enquiries. CONNECTA separates discovery, enquiry and completed sale so commercial claims remain auditable."
    categories={['Businesses', 'Products', 'Services', 'Deals', 'Official Partners']}
    fields={['Verified business', 'Price / availability', 'Trust status', 'Enquiry ID', 'Campaign attribution']}
    emptyTitle="Verified commerce catalogue is ready for connection."
    emptyDescription="Businesses and catalogues can be connected through the verification pipeline. No seller, product, price, availability or partner relationship is presented as active until its source and terms are verified."
  />;
}
