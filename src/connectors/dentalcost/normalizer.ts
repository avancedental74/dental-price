import type { StockStatus, SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";
import { knowledgeForReference } from "../../domain/catalog";
import { promotionForObservedPrices } from "../../domain/promotions";
import type { DentalCostProductRaw, DentalCostVariantRaw } from "./types";

function stock(text?:string):StockStatus{
  if(!text) return "unknown";
  if(/fuera de stock|sin stock|agotado/i.test(text)) return "unavailable";
  const n=text.match(/(\d+)\s*(?:uds?|art)/i); if(n) return Number(n[1])<=5?"low_stock":"in_stock";
  if(/disponible|en stock/i.test(text)) return "in_stock";
  return "unknown";
}
function presentation(text:string):string|undefined{
  if(/jeringa/i.test(text)) return "Jeringa";
  if(/c[aá]psul/i.test(text)) return "Cápsulas";
  if(/caja|peeso|fresa/i.test(text)) return "Caja";
  if(/\bbote\b|\bfrasco\b|\bbotella\b|air[- ]?n[- ]?go|polvo|bicarbonato/i.test(text)) return "Frasco";
}
function quantity(text:string){const m=text.match(/(\d+(?:[.,]\d+)?)\s*(gr|g|ml|mm)\b/i);return m?{quantity:Number(m[1].replace(",",".")),unit:m[2].toLowerCase()==="gr"?"g":m[2].toLowerCase()}:{};}
function pack(text:string):number|undefined{return Number(text.match(/(\d+)\s*(?:c[aá]psulas?|uds?|unidades|botes?|frascos?)/i)?.[1])||undefined;}
function shade(text:string):string|undefined{return text.match(/:\s*([A-Z]\d(?:[,.]5)?|B\d|C\d|D\d)\b/i)?.[1]?.replace(",",".").toUpperCase();}
function variant(text:string):string|undefined{
  const peeso=text.match(/(?:n[ºo°]\s*|numero\s*)([1-6])\b/i)?.[1]; if(peeso) return "No"+peeso;
  if(/body/i.test(text)) return "Body"; if(/dentina/i.test(text)) return "Dentin"; if(/esmalte/i.test(text)) return "Enamel";
}
function offer(raw:DentalCostProductRaw,v:DentalCostVariantRaw):SupplierOffer{
  const text=v.title+" "+raw.title, q=quantity(text), known=knowledgeForReference(v.manufacturerReference);
  return {
    supplierId:"dentalcost",supplierSku:v.supplierSku,manufacturer:raw.manufacturer,manufacturerReference:v.manufacturerReference,
    rawName:v.title||raw.title,normalizedName:normalizeName([raw.title,v.title,raw.manufacturer??""].join(" ")),productUrl:v.productUrl,
    presentation:known.presentation??presentation(text),quantity:known.quantity??q.quantity,unit:known.unit??q.unit,packCount:known.packCount??pack(text),
    variant:known.variant??variant(text),shade:known.shade??shade(v.title),
    stockStatus:stock(v.stockText),rawStockText:v.stockText,
    regularPrice:v.price??raw.regularPrice??raw.salePrice??0,salePrice:v.price??raw.salePrice,
    vatStatus:typeof raw.vatRate==="number"?"excluded":"unknown",vatRate:raw.vatRate,currency:"EUR",
    promotion:promotionForObservedPrices(raw.promotionText??"",raw.regularPrice,v.price??raw.salePrice,raw.title),
    observedAt:new Date().toISOString(),sourceStatus:"normal",sourceMode:"automatic"
  };
}
export function normalizeDentalCost(raw:DentalCostProductRaw):SupplierOffer[]{return raw.variants.map(v=>offer(raw,v)).filter(o=>o.regularPrice>0);}