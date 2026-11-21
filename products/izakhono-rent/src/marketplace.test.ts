import { MarketplaceService, type Listing, type MarketplaceStore } from "./marketplace";
import { assertAvailable, isAvailable, overlaps } from "./availability-service";

class MemoryStore implements MarketplaceStore {
  constructor(private listings: Listing[]) {}
  async getListing(id: string) { return this.listings.find((x) => x.id === id) ?? null; }
  async searchListings() { return this.listings; }
  async saveListing(listing: Listing) { this.listings = this.listings.filter((x) => x.id !== listing.id).concat(listing); }
}

const base: Listing = {
  id: "l1", ownerId: "owner-1", title: "Generator", category: "equipment", location: "Johannesburg",
  currency: "ZAR", rentalPeriod: "day", rentalPrice: 500, depositAmount: 1000,
  status: "draft", verificationStatus: "verified", rentToOwnEnabled: false,
};

const service = new MarketplaceService(new MemoryStore([base]));

const run = async () => {
  const published = await service.publish("l1", "owner-1");
  if (published.status !== "published") throw new Error("PUBLISH_FAILED");
  const found = await service.getPublishedListing("l1");
  if (!found) throw new Error("DISCOVERY_FAILED");

  const a = { listingId: "l1", startsAt: "2026-11-01T10:00:00Z", endsAt: "2026-11-03T10:00:00Z" };
  const b = { listingId: "l1", startsAt: "2026-11-03T10:00:00Z", endsAt: "2026-11-04T10:00:00Z", status: "confirmed" as const };
  if (overlaps(a, b)) throw new Error("BOUNDARY_OVERLAP");
  if (!isAvailable(a, [b])) throw new Error("AVAILABILITY_FAILED");

  const conflict = { ...b, startsAt: "2026-11-02T10:00:00Z" };
  let rejected = false;
  try { assertAvailable(a, [conflict]); } catch (error) { rejected = error instanceof Error && error.message === "LISTING_UNAVAILABLE"; }
  if (!rejected) throw new Error("CONFLICT_NOT_REJECTED");

  console.log("IZAKHONO RENT marketplace/availability tests passed");
};

void run();
