import type { StockStatus, SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";
import { knowledgeForReference } from "../../domain/catalog";
import type { DvdProductRaw, DvdVariantRaw } from "./types";
function stock(t?:string):StockStatus{
 if(!t)return"unknown";
 if(/sin stock|no disponible|agotado/i.test(t))return"unavailable";
 const n=t.match(/(\d+)\s+en stock/i); if(n)return Number(n[1])<=5?"low_stock":"in_stock";
 if(/disponible para compra|recíbelo mañana|en stock/i.test(t))return"in_stock";
 return"unknown";
}
function inferPresentation(text:string):string|undefined{if(/jering/i.test(text))return"Jeringa";if(/compul|c[aá]psul/i.test(text))return"Cápsulas";if(/frasco|bote/i.test(text))return"Frasco";}
function inferQuantity(text:string){
 const multi=text.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(g|gr|ml)\b/i);
 if(multi)return {packCount:Number(multi[1]),quantity:Number(multi[2].replace(",",".")),unit:multi[3].toLowerCase()==="gr"?"g":multi[3].toLowerCase()};
 const m=text.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|ml)\b/i);
 return m?{packCount:1,quantity:Number(m[1].replace(",",".")),unit:m[2].toLowerCase()==="gr"?"g":m[2].toLowerCase()}:{};
}
function toOffer(raw:DvdProductRaw,v:DvdVariantRaw):SupplierOffer{
 const vatRate=v.netPrice&&v.grossPrice?Math.round(((v.grossPrice/v.netPrice)-1)*100):undefined;
 const known=knowledgeForReference(v.manufacturerReference), q=inferQuantity(v.title+" "+raw.title);
 return {supplierId:"dvd-dental",supplierSku:v.supplierSku,manufacturer:raw.manufacturer,manufacturerReference:v.manufacturerReference,
 rawName:v.title,normalizedName:normalizeName([raw.title,v.title,raw.manufacturer??""].join(" ")),productUrl:v.productUrl,
 presentation:known.presentation??inferPresentation(raw.title+" "+v.title),quantity:known.quantity??q.quantity,unit:known.unit??q.unit,packCount:known.packCount??q.packCount,
 variant:known.variant,shade:known.shade,stockStatus:stock(v.stockText),rawStockText:v.stockText,
 regularPrice:v.netPrice??0,salePrice:v.netPrice,vatStatus:typeof vatRate==="number"?"excluded":"unknown",vatRate,currency:"EUR",
 promotion:raw.promotionText?{type:"other",description:raw.promotionText}:undefined,
 observedAt:new Date().toISOString(),sourceStatus:"normal",sourceMode:"automatic"};
}
export function normalizeDvd(raw:DvdProductRaw):SupplierOffer[]{return raw.variants.map(v=>toOffer(raw,v)).filter(o=>o.regularPrice>0);}