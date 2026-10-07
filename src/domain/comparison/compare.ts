import type { CanonicalProduct, FreshnessStatus, SupplierOffer } from "../../types/domain";
import { matchOfferToProduct } from "../matching/matcher";
import { calculatePricing } from "../pricing";
import type { ComparisonResult, MatchedSupplierOffer } from "./types";

export function getFreshnessStatus(offer: SupplierOffer, now = new Date()): FreshnessStatus {
  const observed = new Date(offer.observedAt);
  if (Number.isNaN(observed.getTime())) return "stale";
  const ageHours = (now.getTime() - observed.getTime()) / 3600000;
  if (ageHours < 24) return "fresh";
  if (ageHours <= 72) return "aging";
  return "stale";
}

function hasIncompleteEconomicData(item: MatchedSupplierOffer): boolean {
  return Boolean(item.pricing?.warnings.some(w =>
    w === "IVA no confirmado" ||
    w === "IVA excluido pero tasa desconocida" ||
    w === "Transporte no confirmado"
  ));
}

function rankingEligible(item: MatchedSupplierOffer): boolean {
  const stockEligible=item.offer.stockStatus==="in_stock" || item.offer.stockStatus==="low_stock";
  return (
    item.match.status === "EXACT" &&
    item.offer.sourceStatus === "normal" &&
    stockEligible &&
    getFreshnessStatus(item.offer) !== "stale" &&
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
    const pricing = (() => {
      try { return calculatePricing(offer, { requestedQuantity: quantity, includeVat: true }); }
      catch { return null; }
    })();
    const item: MatchedSupplierOffer = { product, offer, match, pricing, eligibleForRanking: false };
    item.eligibleForRanking = rankingEligible(item);
    return item;
  });

  const ranked = matches.filter(item=>item.eligibleForRanking).sort((a,b)=>{
    const costDiff=(a.pricing?.effectiveTotalCost ?? Infinity)-(b.pricing?.effectiveTotalCost ?? Infinity);
    if(costDiff!==0) return costDiff;
    const unitDiff=(a.pricing?.effectiveUnitCost ?? Infinity)-(b.pricing?.effectiveUnitCost ?? Infinity);
    if(unitDiff!==0) return unitDiff;
    return new Date(b.offer.observedAt).getTime()-new Date(a.offer.observedAt).getTime();
  });

  return {product,quantity,matches,ranked,rejected:matches.filter(item=>!item.eligibleForRanking)};
}