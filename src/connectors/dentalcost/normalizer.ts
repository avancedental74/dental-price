import type { StockStatus, SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";
import type { DentalCostProductRaw, DentalCostVariantRaw } from "./types";

function stock(text?:string):StockStatus{
  if(!text) return "unknown";
  if(/fuera de stock|sin stock|agotado/i.test(text)) return "unavailable";
  const n=text.match(/(\d+)\s*(?:uds?|art)/i);
  if(n) return Number(n[1])<=5?"low_stock":"in_stock";
  if(/disponible|en stock/i.test(text)) return "in_stock";
  return "unknown";
}
function presentation(text:string):string|undefined{
  if(/jeringa/i.test(text)) return "Jeringa";
  if(/c[aá]psul/i.test(text)) return "Cápsulas";
  if(/caja/i.test(text)) return "Caja";
}
function quantity(text:string){const m=text.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|ml)\b/i);return m?{quantity:Number(m[1].replace(",",".")),unit:m[2].toLowerCase()==="gr"?"g":m[2].toLowerCase()}:{};}
function pack(text:string):number|undefined{return Number(text.match(/(\d+)\s*(?:c[aá]psulas?|uds?)/i)?.[1])||undefined;}
function shade(ref?:string,text=""):string|undefined{return ref?.match(/^4910([A-Z]+\d(?:\.5)?)/i)?.[1]?.toUpperCase() ?? text.match(/:\s*([A-Z]\d(?:[,.]5)?|B\d|C\d|D\d)\b/i)?.[1]?.replace(",",".").toUpperCase();}
function variant(ref?:string,text=""):string|undefined{
  const s=ref?.match(/^4910.+([BDE])$/i)?.[1]?.toUpperCase();
  if(s==="B"||/body/i.test(text)) return "Body";
  if(s==="D"||/dentina/i.test(text)) return "Dentin";
  if(s==="E"||/esmalte/i.test(text)) return "Enamel";
}
function offer(raw:DentalCostProductRaw,v:DentalCostVariantRaw):SupplierOffer{
  const q=quantity(v.title+" "+raw.title);
  return {
    supplierId:"dentalcost",supplierSku:v.supplierSku,manufacturer:raw.manufacturer,manufacturerReference:v.manufacturerReference,
    rawName:v.title||raw.title,normalizedName:normalizeName([raw.title,v.title,raw.manufacturer??""].join(" ")),productUrl:v.productUrl,
    presentation:presentation(v.title+" "+raw.title) ?? (/^4910/i.test(v.manufacturerReference??"")?"Jeringa":undefined),quantity:q.quantity,unit:q.unit,packCount:pack(v.title+" "+raw.title)??1,
    variant:variant(v.manufacturerReference,v.title+" "+raw.title),shade:shade(v.manufacturerReference,v.title),
    stockStatus:stock(v.stockText),rawStockText:v.stockText,
    regularPrice:v.price??raw.regularPrice??raw.salePrice??0,salePrice:v.price??raw.salePrice,
    vatStatus:typeof raw.vatRate==="number"?"excluded":"unknown",vatRate:raw.vatRate,currency:"EUR",
    shippingCost:5.8,shippingCostVatIncluded:false,shippingVatRate:21,freeShippingThreshold:120,freeShippingThresholdBasis:"gross",
    deliveryZone:"ES_PENINSULA",observedAt:new Date().toISOString(),sourceStatus:"normal",sourceMode:"automatic"
  };
}
export function normalizeDentalCost(raw:DentalCostProductRaw):SupplierOffer[]{return raw.variants.map(v=>offer(raw,v)).filter(o=>o.regularPrice>0);}
