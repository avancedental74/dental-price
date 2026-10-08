import type { CanonicalProduct, SupplierOffer } from "../types/domain";
import type { PriceObservation } from "../domain/history";
import { appendObservation } from "../domain/history";
import { calculatePricing } from "../domain/pricing";
import { normalizeReference } from "../domain/matching/normalization";

const LIVE_HISTORY_KEY="dental-price:live-history:v1";
const MAX_OBSERVATIONS=5000;

export function loadLiveHistory():PriceObservation[]{
  if(typeof window==="undefined")return [];
  try{
    const raw=JSON.parse(window.localStorage.getItem(LIVE_HISTORY_KEY)??"[]");
    return Array.isArray(raw)?raw:[];
  }catch{return [];}
}

export function saveLiveHistory(history:PriceObservation[]):void{
  if(typeof window==="undefined")return;
  window.localStorage.setItem(LIVE_HISTORY_KEY,JSON.stringify(history.slice(-MAX_OBSERVATIONS)));
}

export function recordLiveSearchHistory(
  current:PriceObservation[],
  groups:Array<{product:CanonicalProduct;offers:SupplierOffer[]}>,
  catalog:CanonicalProduct[]
):PriceObservation[]{
  let next=[...current];
  for(const group of groups){
    const ref=normalizeReference(group.product.manufacturerReference);
    const productId=(ref?catalog.find(p=>normalizeReference(p.manufacturerReference)===ref)?.id:undefined)??group.product.id;
    for(const offer of group.offers){
      if(offer.verificationKind!=="live"||!offer.verificationSessionId||!offer.verifiedAt)continue;
      let unitCost:number|undefined,totalCost:number|undefined;
      try{
        const pricing=calculatePricing(offer,{requestedQuantity:1,includeVat:true});
        const incomplete=pricing.warnings.some(w=>w.includes("no confirmado")||w.includes("desconocida"));
        if(!incomplete){unitCost=pricing.effectiveUnitCost;totalCost=pricing.effectiveTotalCost;}
      }catch{ /* retain raw verified observation even when total cost is incomplete */ }
      next=appendObservation(next,productId,offer,unitCost,totalCost,1).history;
    }
  }
  return next.slice(-MAX_OBSERVATIONS);
}
