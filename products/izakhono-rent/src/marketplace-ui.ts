export type RentCategory =
  | 'Homes & Stays'
  | 'Vehicles'
  | 'Tools & Equipment'
  | 'Electronics'
  | 'Events & Production'
  | 'Cameras & Drones'
  | 'Agriculture & Industrial'
  | 'Furniture'
  | 'Fashion & Wearables'
  | 'Sports & Outdoor'
  | 'Business & Office'
  | 'Storage & Parking';

export interface MarketplaceListing {
  id: string;
  title: string;
  category: RentCategory;
  location: string;
  price: number;
  currency: string;
  period: 'hour' | 'day' | 'week' | 'month';
  verified: boolean;
  available: boolean;
}

export interface MarketplaceFilters {
  query?: string;
  category?: RentCategory;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  period?: MarketplaceListing['period'];
  verifiedOnly?: boolean;
}

export function filterMarketplaceListings(
  listings: MarketplaceListing[],
  filters: MarketplaceFilters,
): MarketplaceListing[] {
  const query = filters.query?.trim().toLowerCase();
  const location = filters.location?.trim().toLowerCase();
  return listings.filter((listing) => {
    if (query && !`${listing.title} ${listing.category} ${listing.location}`.toLowerCase().includes(query)) return false;
    if (filters.category && listing.category !== filters.category) return false;
    if (location && !listing.location.toLowerCase().includes(location)) return false;
    if (filters.minPrice !== undefined && listing.price < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && listing.price > filters.maxPrice) return false;
    if (filters.period && listing.period !== filters.period) return false;
    if (filters.verifiedOnly && !listing.verified) return false;
    return listing.available;
  });
}

export function serializeMarketplaceQuery(filters: MarketplaceFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}
