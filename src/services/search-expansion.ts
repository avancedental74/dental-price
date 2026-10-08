import {normalizeName, normalizeReference} from "../domain/matching/normalization";
import type {SupplierOffer} from "../types/domain";

// Controlled lexical alternatives, not substitutions of products.
// Keep every model code, size, shade and other terms in the query.
const ALIASES:Array<[RegExp,string]>=[
  [/\bguantes\b/i,"guante"],
  [/\bfresas\b/i,"fresa"],
  [/\bimplantes\b/i,"implante"],
  [/\bcementos\b/i,"cemento"],
  [/\bcomposites\b/i,"composite"],
  [/\badhesivos\b/i,"adhesivo"],
  [/\bresinas compuestas\b/i,"composite"],
  [/\bresina compuesta\b/i,"composite"],
  [/\bcomposite\b/i,"resina compuesta"],
  [/\bdentina\b/i,"dentin"],
  [/\bdentin\b/i,"dentina"],
  [/\besmalte\b/i,"enamel"],
  [/\benamel\b/i,"esmalte"],
  [/\bjeringas\b/i,"jeringa"],
  [/\bcapsulas\b/i,"capsula"]
];

export function planSupplierQueries(query:string,extended:boolean):string[]{
  const original=query.replace(/\s+/g," ").trim();
  if(!original)return [];
  if(!extended)return [original];
  // Never broaden an SKU/EAN search: punctuation can be meaningful in a reference.
  const compact=normalizeReference(original)??"";
  if(!original.includes(" ")&&compact.length>=4&&/\d/.test(compact))return [original];
  for(const [pattern,replacement] of ALIASES){
    if(!pattern.test(original))continue;
    const other=original.replace(pattern,replacement).replace(/\s+/g," ").trim();
    if(other&&normalizeName(other)!==normalizeName(original))return [original,other];
  }
  return [original];
}

export function mergeSupplierQueryOffers(offers:SupplierOffer[]):SupplierOffer[]{
  const result=new Map<string,SupplierOffer>();
  for(const offer of offers){
    // A seller SKU is unique only within that supplier.
    const key=[offer.supplierId,normalizeReference(offer.supplierSku)
      ??offer.productUrl+"|"+normalizeName(offer.rawName),
      normalizeReference(offer.manufacturerReference)??"",
      normalizeName(offer.variant??""),normalizeName(offer.shade??"")].join("|");
    const previous=result.get(key);
    if(!previous){result.set(key,offer);continue;}
    const old=previous.salePrice??previous.regularPrice;
    const next=offer.salePrice??offer.regularPrice;
    // Disagreement on a price from two search paths should never create a false winner.
    if(Math.abs(old-next)>0.01){
      result.set(key,{...previous,sourceStatus:"suspicious"});
    }else if(previous.sourceStatus!=="suspicious"){
      const latest=new Date(offer.observedAt).getTime()>new Date(previous.observedAt).getTime();
      if(latest)result.set(key,offer);
    }
  }
  return [...result.values()];
}
