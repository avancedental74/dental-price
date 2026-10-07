import type { CanonicalProduct, SupplierOffer } from "../../types/domain";
import type { MatchResult } from "../matching/types";
import type { PricingBreakdown } from "../pricing";

export interface MatchedSupplierOffer {
  product: CanonicalProduct;
  offer: SupplierOffer;
  match: MatchResult;
  pricing: PricingBreakdown | null;
  eligibleForRanking: boolean;
}

export interface ComparisonResult {
  product: CanonicalProduct;
  quantity: number;
  matches: MatchedSupplierOffer[];
  ranked: MatchedSupplierOffer[];
  rejected: MatchedSupplierOffer[];
}