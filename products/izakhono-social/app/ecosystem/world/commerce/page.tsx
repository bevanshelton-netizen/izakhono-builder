import { DiscoverySurface } from '@/components/discovery-surface';

export default function CommercePage() {
  return <DiscoverySurface
    eyebrow="CONNECTA COMMERCE"
    title="Find businesses, products and services."
    description="A trusted commercial discovery layer for verified businesses, catalogues, partner storefronts, services, campaigns and customer enquiries. CONNECTA separates discovery, enquiry and completed sale so commercial claims remain auditable."
    categories={['Businesses', 'Products', 'Services', 'Deals', 'Official Partners']}
    fields={['Verified business', 'Price / availability', 'Trust status', 'Enquiry ID', 'Campaign attribution']}
    emptyTitle="No verified commerce listings yet."
    emptyDescription="Verified businesses and catalogues will populate this category once their source, identity and terms pass the CONNECTA verification pipeline."
  />;
}
