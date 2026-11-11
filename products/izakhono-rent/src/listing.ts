export type ListingStatus = "draft" | "published" | "paused" | "archived";
export type VerificationStatus = "pending" | "verified" | "rejected";

export interface RentListingInput {
  title: string;
  description: string;
  category: string;
  location: string;
  rentalPrice: number;
  currency: string;
  rentalPeriod: "hour" | "day" | "week" | "month";
  ownerVerified: boolean;
  verificationStatus: VerificationStatus;
}

export interface ListingValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateListing(input: RentListingInput): ListingValidationResult {
  const errors: string[] = [];
  if (input.title.trim().length < 3) errors.push("title_required");
  if (input.description.trim().length < 10) errors.push("description_required");
  if (input.category.trim().length === 0) errors.push("category_required");
  if (input.location.trim().length === 0) errors.push("location_required");
  if (!Number.isFinite(input.rentalPrice) || input.rentalPrice <= 0) errors.push("rental_price_invalid");
  if (input.currency.length !== 3) errors.push("currency_invalid");
  return { valid: errors.length === 0, errors };
}

export function canPublishListing(input: RentListingInput): boolean {
  return validateListing(input).valid && input.ownerVerified && input.verificationStatus === "verified";
}
