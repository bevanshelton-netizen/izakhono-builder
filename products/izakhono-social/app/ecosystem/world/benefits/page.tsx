import { DiscoverySurface } from '@/components/discovery-surface';

export default function BenefitsPage() {
  return <DiscoverySurface
    eyebrow="CONNECTA BENEFITS"
    title="Come here before you spend money."
    description="A trusted discovery page for coupons, exclusive deals, flights, competitions, giveaways, free products and services, jobs, education and community opportunities. Benefits appear only when their terms and evidence are verified."
    categories={['Deals', 'Flights', 'Competitions', 'Giveaways', 'FREE', 'Jobs', 'Education', 'Community']}
    fields={['Verified provider', 'Offer terms', 'Start / end dates', 'Claim method', 'Attribution']}
    emptyTitle="Verified benefits inventory is ready for connection."
    emptyDescription="The surface is now in place. Verified partner offers, promotions and opportunities can populate it through the CONNECTA verification and commerce pipeline without inventing discounts, prizes, partners or availability."
  />;
}
