import { DiscoverySurfaceClient } from '@/components/discovery-surface-client';

export default function VehiclesPage() {
  return <DiscoverySurfaceClient
    kind="vehicle"
    eyebrow="CONNECTA VEHICLES"
    title="Every vehicle. One trusted discovery category."
    description="A first-class vehicle marketplace surface for new and used vehicles, imports, commercial vehicles, motorcycles, parts and services. Structured inventory, seller identity, enquiries and partner attribution are designed for verification from the start."
    categories={['For Sale', 'New', 'Used', 'Imports', 'Commercial', 'Motorcycles', 'Parts & Services']}
    fields={['Verified seller', 'Make / model / year', 'Price / mileage', 'Transmission / fuel', 'Stock reference', 'Location']}
    emptyTitle="No verified vehicle inventory yet."
    emptyDescription="Vehicle feeds, dealer catalogues and partner inventory will populate this category once their source, seller identity and relationship are verified."
  />;
}
