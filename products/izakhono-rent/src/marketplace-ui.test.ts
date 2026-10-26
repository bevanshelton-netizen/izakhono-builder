import { describe, expect, it } from 'vitest';
import { filterMarketplaceListings, serializeMarketplaceQuery, type MarketplaceListing } from './marketplace-ui';

const listings: MarketplaceListing[] = [
  { id: '1', title: '60kVA Generator', category: 'Agriculture & Industrial', location: 'Johannesburg', price: 2400, currency: 'ZAR', period: 'day', verified: true, available: true },
  { id: '2', title: 'Toyota Quantum', category: 'Vehicles', location: 'Johannesburg', price: 1250, currency: 'ZAR', period: 'day', verified: true, available: true },
  { id: '3', title: 'Event Gazebo', category: 'Events & Production', location: 'Soweto', price: 850, currency: 'ZAR', period: 'day', verified: false, available: true },
  { id: '4', title: 'Camera Kit', category: 'Cameras & Drones', location: 'Cape Town', price: 1100, currency: 'ZAR', period: 'day', verified: true, available: false },
];

describe('marketplace filtering', () => {
  it('searches title/category/location case-insensitively', () => {
    expect(filterMarketplaceListings(listings, { query: 'generator' }).map((x) => x.id)).toEqual(['1']);
    expect(filterMarketplaceListings(listings, { query: 'johannesburg' }).map((x) => x.id)).toEqual(['1', '2']);
  });

  it('applies category, price, period and verified filters', () => {
    expect(filterMarketplaceListings(listings, { category: 'Vehicles', verifiedOnly: true })).toHaveLength(1);
    expect(filterMarketplaceListings(listings, { maxPrice: 1000 })).toEqual([listings[2]]);
    expect(filterMarketplaceListings(listings, { period: 'day' })).toHaveLength(3);
  });

  it('never returns unavailable inventory', () => {
    expect(filterMarketplaceListings(listings, {}).some((x) => x.id === '4')).toBe(false);
  });

  it('serializes non-empty filters for API navigation', () => {
    expect(serializeMarketplaceQuery({ query: 'generator', category: 'Agriculture & Industrial', verifiedOnly: true })).toContain('query=generator');
    expect(serializeMarketplaceQuery({ query: '', minPrice: undefined })).toBe('');
  });
});
