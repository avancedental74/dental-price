import type { CanonicalProduct, SupplierOffer } from "../../types/domain";
import { matchOfferToProduct } from "../matching/matcher";
import { calculatePricing } from "../pricing";
import type { ComparisonResult, MatchedSupplierOffer } from "./types";

function isFreshEnough(offer: SupplierOffer, now = new Date()): boolean {
  const observed = new Date(offer.observedAt);
  if (Number.isNaN(observed.getTime())) return false;
  const ageMs = now.getTime() - observed.getTime();
  return ageMs <= 72 * 60 * 60 * 1000;
}

function hasIncompleteEconomicData(item: MatchedSupplierOffer): boolean {
  return Boolean(item.pricing?.warnings.some(w => w === "IVA no confirmado" || w === "IVA excluido pero tasa desconocida" || w === "Transporte no confirmado"));
}

function rankingEligible(item: MatchedSupplierOffer): boolean {
  return (
    item.match.status === "EXACT" &&
    item.offer.sourceStatus !== "quarantined" &&
    item.offer.stockStatus !== "unavailable" &&
    isFreshEnough(item.offer) &&
    item.pricing !== null &&
    item.pricing.effectiveTotalCost > 0 &&
    !hasIncompleteEconomicData(item)
  );
}

export function compareSupplierOffers(
  product: CanonicalProduct,
  offers: SupplierOffer[],
  quantity = 1
): ComparisonResult {
  const matches = offers.map((offer): MatchedSupplierOffer => {
    const match = matchOfferToProduct(product, offer);
    let pricing = null;
    try {
      pricing = calculatePricing(offer, { requestedQuantity: quantity, includeVat: true });
    } catch {
      pricing = null;
    }
    const item: MatchedSupplierOffer = { product, offer, match, pricing, eligibleForRanking: false };
    item.eligibleForRanking = rankingEligible(item);
    return item;
  });

  const ranked = matches
    .filter((item) => item.eligibleForRanking)
    .sort((a, b) => {
      const costDiff = (a.pricing?.effectiveTotalCost ?? Infinity) - (b.pricing?.effectiveTotalCost ?? Infinity);
      if (costDiff !== 0) return costDiff;
      const unitDiff = (a.pricing?.effectiveUnitCost ?? Infinity) - (b.pricing?.effectiveUnitCost ?? Infinity);
      if (unitDiff !== 0) return unitDiff;
      return new Date(b.offer.observedAt).getTime() - new Date(a.offer.observedAt).getTime();
    });

  return {
    product, quantity, matches, ranked,
    rejected: matches.filter((item) => !item.eligibleForRanking)
  };
}