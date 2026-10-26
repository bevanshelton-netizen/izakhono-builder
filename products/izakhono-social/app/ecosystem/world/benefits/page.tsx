import { DiscoverySurfaceClient } from '@/components/discovery-surface-client';

export default function BenefitsPage() {
  return <DiscoverySurfaceClient
    kind="benefit"
    eyebrow="CONNECTA BENEFITS"
    title="Come here before you spend money."
    description="A trusted discovery page for coupons, exclusive deals, flights, competitions, giveaways, free products and services, jobs, education and community opportunities. Benefits appear only when their terms and evidence are verified."
    categories={['Deals', 'Flights', 'Competitions', 'Giveaways', 'FREE', 'Jobs', 'Education', 'Community']}
    fields={['Verified provider', 'Offer terms', 'Start / end dates', 'Claim method', 'Attribution']}
    emptyTitle="No verified benefits yet."
    emptyDescription="Verified partner offers, promotions and opportunities will populate this surface through the CONNECTA verification and commerce pipeline."
  />;
}
