import type { CanonicalProduct } from "../types/domain";
import { normalizeName, normalizeReference } from "./matching/normalization";

export interface ProductSearchResult { product:CanonicalProduct; score:number; exactReference:boolean; }

export function searchProducts(products:CanonicalProduct[],query:string,limit=8):ProductSearchResult[]{
  const q=normalizeName(query);
  const ref=normalizeReference(query);
  if(!q && !ref) return [];
  return products.map(product=>{
    const exactReference=Boolean(ref&&(normalizeReference(product.manufacturerReference)===ref||normalizeReference(product.eanGtin)===ref));
    if(exactReference) return {product,score:1,exactReference:true};
    const tokens=q.split(" ").filter(Boolean);
    const hay=normalizeName([product.manufacturer,product.brand??"",product.family,product.productName,product.variant??"",product.shade??"",product.presentation,product.manufacturerReference??""].join(" "));
    const hits=tokens.filter(t=>hay.includes(t)).length;
    const score=tokens.length?hits/tokens.length:0;
    return {product,score,exactReference:false};
  }).filter(x=>x.exactReference||x.score>=0.45).sort((a,b)=>Number(b.exactReference)-Number(a.exactReference)||b.score-a.score).slice(0,limit);
}
