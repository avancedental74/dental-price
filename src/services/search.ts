import type { CanonicalProduct } from "../types/domain";
import { normalizeName, normalizeReference } from "../domain/matching/normalization";

export interface ProductSearchResult { product: CanonicalProduct; score: number; }

export function searchProducts(products:CanonicalProduct[],query:string):ProductSearchResult[]{
  const raw=query.trim();
  if(!raw) return [];
  const ref=normalizeReference(raw);
  const normalized=normalizeName(raw);
  const tokens=normalized.split(" ").filter(Boolean);
  return products.map(product=>{
    const productRef=normalizeReference(product.manufacturerReference);
    const ean=normalizeReference(product.eanGtin);
    const haystack=normalizeName([product.manufacturer,product.brand,product.family,product.productName,product.variant,product.shade,product.presentation,product.normalizedName].filter(Boolean).join(" "));
    let score=0;
    if(ref && (ref===productRef || ref===ean)) score=1000;
    else {
      if(haystack===normalized) score+=300;
      if(haystack.includes(normalized)) score+=120;
      for(const token of tokens) if(haystack.includes(token)) score+=20;
      if(productRef && ref && productRef.includes(ref)) score+=80;
    }
    return {product,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || a.product.family.localeCompare(b.product.family)).slice(0,12);
}