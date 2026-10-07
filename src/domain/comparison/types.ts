import type { CanonicalProduct, SupplierOffer } from "../../types/domain";
import type { MatchResult } from "../matching/types";

export interface MatchedSupplierOffer {
  product: CanonicalProduct;
  offer: SupplierOffer;
  match: MatchResult;
  eligibleForRanking: boolean;
}

export interface ComparisonResult {
  product: CanonicalProduct;
  quantity: number;
  matches: MatchedSupplierOffer[];
  ranked: MatchedSupplierOffer[];
  rejected: MatchedSupplierOffer[];
}