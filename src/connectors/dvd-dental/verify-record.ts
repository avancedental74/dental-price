import type {SupplierOffer} from "../../types/domain";
import type {DvdKlevuRecord} from "../live-search";
import {normalizeReference} from "../../domain/matching/normalization";

// Klevu is a discovery index. Its price/stock may be stale or for a
// different dropdown variant. Prices are only evidence from a product page
// when its own SKU or manufacturer reference can be matched exactly.
export function verifiedDvdDetailOffers(record:DvdKlevuRecord,offers:SupplierOffer[]):SupplierOffer[]{
  const sku=normalizeReference(record.sku);
  const ref=normalizeReference(record["nº_pieza_fabricante"]);
  if(!sku&&!ref)return [];
  return offers.filter(offer=>{
    const offerSku=normalizeReference(offer.supplierSku);
    const offerRef=normalizeReference(offer.manufacturerReference);
    // A contradictory identifier invalidates the candidate, even if its other ID matches.
    if(ref&&offerRef&&ref!==offerRef)return false;
    if(sku&&offerSku&&sku!==offerSku)return false;
    return Boolean((ref&&offerRef===ref)||(sku&&offerSku===sku));
  }).map(offer=>({...offer,priceVerification:"detail" as const}));
}
