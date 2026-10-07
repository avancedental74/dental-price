import type { MatchedSupplierOffer } from "./types";

export interface ComparisonExplanation {
  supplierId: string;
  status: string;
  eligible: boolean;
  reasons: string[];
  conflicts: string[];
  displayPrice: number | null;
}

export function explainComparison(item: MatchedSupplierOffer): ComparisonExplanation {
  const price = item.offer.salePrice ?? item.offer.regularPrice;
  const reasons = item.match.reasons
    .filter((reason) => reason.matched)
    .map((reason) => reason.label);

  if (item.offer.stockStatus === "unavailable") reasons.push("Sin stock");
  if (item.offer.sourceStatus === "quarantined") reasons.push("Precio en cuarentena");

  return {
    supplierId: item.offer.supplierId,
    status: item.match.status,
    eligible: item.eligibleForRanking,
    reasons,
    conflicts: item.match.conflicts,
    displayPrice: Number.isFinite(price) ? price : null
  };
}