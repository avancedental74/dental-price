import type { CanonicalProduct, SupplierOffer } from "../../types/domain";
import { matchOfferToProduct } from "../matching/matcher";
import type { ComparisonResult, MatchedSupplierOffer } from "./types";

function effectiveBasePrice(offer: SupplierOffer): number {
  const candidate = offer.salePrice ?? offer.regularPrice;
  return Number.isFinite(candidate) ? candidate : Number.POSITIVE_INFINITY;
}

function isFreshEnough(offer: SupplierOffer, now = new Date()): boolean {
  const observed = new Date(offer.observedAt);
  if (Number.isNaN(observed.getTime())) return false;
  const ageMs = now.getTime() - observed.getTime();
  return ageMs <= 72 * 60 * 60 * 1000;
}

function rankingEligible(item: MatchedSupplierOffer): boolean {
  return (
    item.match.status === "EXACT" &&
    item.offer.sourceStatus !== "quarantined" &&
    item.offer.stockStatus !== "unavailable" &&
    isFreshEnough(item.offer) &&
    effectiveBasePrice(item.offer) > 0
  );
}

export function compareSupplierOffers(
  product: CanonicalProduct,
  offers: SupplierOffer[],
  quantity = 1
): ComparisonResult {
  const matches = offers.map((offer): MatchedSupplierOffer => {
    const match = matchOfferToProduct(product, offer);
    const item: MatchedSupplierOffer = {
      product,
      offer,
      match,
      eligibleForRanking: false
    };
    item.eligibleForRanking = rankingEligible(item);
    return item;
  });

  const ranked = matches
    .filter((item) => item.eligibleForRanking)
    .sort((a, b) => {
      const priceDiff = effectiveBasePrice(a.offer) - effectiveBasePrice(b.offer);
      if (priceDiff !== 0) return priceDiff;
      return new Date(b.offer.observedAt).getTime() - new Date(a.offer.observedAt).getTime();
    });

  return {
    product,
    quantity,
    matches,
    ranked,
    rejected: matches.filter((item) => !item.eligibleForRanking)
  };
}