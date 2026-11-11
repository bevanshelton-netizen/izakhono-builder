export type ListingStatus = "draft" | "published" | "paused" | "archived";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface Listing {
  id: string;
  ownerId: string;
  title: string;
  category: string;
  location: string;
  currency: string;
  rentalPeriod: "hour" | "day" | "week" | "month";
  rentalPrice: number;
  salePrice?: number;
  depositAmount: number;
  status: ListingStatus;
  verificationStatus: VerificationStatus;
  rentToOwnEnabled: boolean;
}

export interface ListingQuery {
  category?: string;
  location?: string;
  maxPrice?: number;
  rentalPeriod?: Listing["rentalPeriod"];
}

export interface MarketplaceStore {
  getListing(id: string): Promise<Listing | null>;
  searchListings(query: ListingQuery): Promise<Listing[]>;
  saveListing(listing: Listing): Promise<void>;
}

export class MarketplaceService {
  constructor(private readonly store: MarketplaceStore) {}

  async getPublishedListing(id: string): Promise<Listing | null> {
    const listing = await this.store.getListing(id);
    if (!listing || listing.status !== "published" || listing.verificationStatus !== "verified") return null;
    return listing;
  }

  async discover(query: ListingQuery): Promise<Listing[]> {
    const listings = await this.store.searchListings(query);
    return listings.filter((listing) => listing.status === "published" && listing.verificationStatus === "verified");
  }

  async createDraft(input: Omit<Listing, "status"> & { status?: ListingStatus }): Promise<Listing> {
    if (!input.ownerId || !input.title.trim() || !input.category.trim()) throw new Error("INVALID_LISTING");
    if (input.rentalPrice < 0 || input.depositAmount < 0) throw new Error("INVALID_PRICE");
    const listing: Listing = { ...input, status: "draft" };
    await this.store.saveListing(listing);
    return listing;
  }

  async publish(listingId: string, actorId: string): Promise<Listing> {
    const listing = await this.store.getListing(listingId);
    if (!listing) throw new Error("LISTING_NOT_FOUND");
    if (listing.ownerId !== actorId) throw new Error("FORBIDDEN");
    if (listing.verificationStatus !== "verified") throw new Error("LISTING_NOT_VERIFIED");
    if (listing.status === "archived") throw new Error("LISTING_ARCHIVED");
    const published = { ...listing, status: "published" as const };
    await this.store.saveListing(published);
    return published;
  }
}
