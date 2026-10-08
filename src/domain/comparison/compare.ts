import type { CanonicalProduct, FreshnessStatus, SupplierOffer } from "../../types/domain";
import { matchOfferToProduct } from "../matching/matcher";
import { calculatePricing } from "../pricing";
import type { ComparisonOptions, ComparisonResult, MatchedSupplierOffer } from "./types";

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

function shippingPolicyFresh(item:MatchedSupplierOffer,now=new Date()):boolean{
  if(item.offer.sourceMode!=="automatic") return true;
  if(typeof item.offer.shippingCost!=="number" && typeof item.offer.freeShippingThreshold!=="number") return false;
  if(!item.offer.shippingPolicyObservedAt) return false;
  const observed=new Date(item.offer.shippingPolicyObservedAt).getTime();
  if(Number.isNaN(observed)) return false;
  return (now.getTime()-observed)/86400000 <= 30;
}

function belongsToRequiredLiveSession(item:MatchedSupplierOffer,options:ComparisonOptions):boolean{
  if(!options.requiredLiveSessionId) return true;
  return item.offer.verificationKind==="live" &&
    item.offer.verificationSessionId===options.requiredLiveSessionId &&
    Boolean(item.offer.verifiedAt);
}

function rankingEligible(item: MatchedSupplierOffer, options:ComparisonOptions): boolean {
  const stockEligible=item.offer.stockStatus==="in_stock" || item.offer.stockStatus==="low_stock";
  return (
    belongsToRequiredLiveSession(item,options) &&
    item.offer.priceVerification!=="search_index" &&
    item.match.status === "EXACT" &&
    item.offer.sourceStatus === "normal" &&
    stockEligible &&
    getFreshnessStatus(item.offer) !== "stale" &&
    item.pricing !== null &&
    item.pricing.effectiveTotalCost > 0 &&
    !hasIncompleteEconomicData(item) &&
    shippingPolicyFresh(item)
  );
}

export function compareSupplierOffers(
  product: CanonicalProduct,
  offers: SupplierOffer[],
  quantity = 1,
  options:ComparisonOptions={}
): ComparisonResult {
  const matches = offers.map((offer): MatchedSupplierOffer => {
    const match = matchOfferToProduct(product, offer);
    const pricing = (() => {
      try { return calculatePricing(offer, { requestedQuantity: quantity, includeVat: true }); }
      catch { return null; }
    })();
    const item: MatchedSupplierOffer = { product, offer, match, pricing, eligibleForRanking: false };
    item.eligibleForRanking = rankingEligible(item,options);
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