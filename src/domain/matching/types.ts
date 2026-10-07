import type { CanonicalProduct, SupplierOffer, MatchStatus } from "../../types/domain";

export interface MatchReason {
  code: string;
  label: string;
  weight: number;
  matched: boolean;
}

export interface MatchResult {
  status: MatchStatus;
  score: number;
  hardReject: boolean;
  reasons: MatchReason[];
  conflicts: string[];
  canonicalProductId: string;
  supplierId: string;
  supplierSku?: string;
}

export interface MatchCandidate {
  product: CanonicalProduct;
  offer: SupplierOffer;
}
