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
  if(/caja|peeso|fresa/i.test(text)) return "Caja";
  if(/\bbote\b|\bfrasco\b|\bbotella\b/i.test(text)) return "Frasco";
  if(/air[- ]?n[- ]?go|polvo|bicarbonato|botes?|frascos?/i.test(text)) return "Frasco";
}
function quantity(text:string){const m=text.match(/(\d+(?:[.,]\d+)?)\s*(gr|g|ml|mm)\b/i);return m?{quantity:Number(m[1].replace(",",".")),unit:m[2].toLowerCase()==="gr"?"g":m[2].toLowerCase()}:{};}
function pack(text:string):number|undefined{return Number(text.match(/(\d+)\s*(?:c[aá]psulas?|uds?|unidades|botes?|frascos?)/i)?.[1])||undefined;}
function shade(ref?:string,text=""):string|undefined{
  return ref?.match(/^4910([A-Z]+\d(?:\.5)?)/i)?.[1]?.toUpperCase()
    ?? ref?.match(/^6020([A-Z]\d(?:\.5)?)$/i)?.[1]?.toUpperCase()
    ?? ref?.match(/^6021([A-Z]\d(?:\.5)?|UD)$/i)?.[1]?.toUpperCase()
    ?? text.match(/:\s*([A-Z]\d(?:[,.]5)?|B\d|C\d|D\d)\b/i)?.[1]?.replace(",",".").toUpperCase();
}
function variant(ref?:string,text=""):string|undefined{
  const peeso=text.match(/(?:n[ºo°]\s*|numero\s*)([1-6])\b/i)?.[1];
  if(peeso) return "No"+peeso;
  const s=ref?.match(/^4910.+([BDE])$/i)?.[1]?.toUpperCase();
  if(s==="B"||/body/i.test(text)) return "Body";
  if(s==="D"||/dentina/i.test(text)) return "Dentin";
  if(s==="E"||/esmalte/i.test(text)) return "Enamel";
}
function offer(raw:DentalCostProductRaw,v:DentalCostVariantRaw):SupplierOffer{
  const q=quantity(v.title+" "+raw.title);
  const isAdper4242=v.manufacturerReference==="4242";
  return {
    supplierId:"dentalcost",supplierSku:v.supplierSku,manufacturer:raw.manufacturer,manufacturerReference:v.manufacturerReference,
    rawName:v.title||raw.title,normalizedName:normalizeName([raw.title,v.title,raw.manufacturer??""].join(" ")),productUrl:v.productUrl,
    presentation:presentation(v.title+" "+raw.title) ?? (/^(4910|6020)/i.test(v.manufacturerReference??"")?"Jeringa":/^6021/i.test(v.manufacturerReference??"")?"Cápsulas":v.manufacturerReference==="4242"?"Frasco":undefined),
    quantity:isAdper4242?6:(q.quantity ?? (/^6020/i.test(v.manufacturerReference??"")?4:/^6021/i.test(v.manufacturerReference??"")?0.2:undefined)),
    unit:isAdper4242?"g":(q.unit ?? (/^602[01]/i.test(v.manufacturerReference??"")?"g":undefined)),
    packCount:isAdper4242?1:(pack(v.title+" "+raw.title) ?? (/^6021/i.test(v.manufacturerReference??"")?20:1)),
    variant:variant(v.manufacturerReference,v.title+" "+raw.title),shade:shade(v.manufacturerReference,v.title),
    stockStatus:stock(v.stockText),rawStockText:v.stockText,
    regularPrice:v.price??raw.regularPrice??raw.salePrice??0,salePrice:v.price??raw.salePrice,
    vatStatus:typeof raw.vatRate==="number"?"excluded":"unknown",vatRate:raw.vatRate,currency:"EUR",
    shippingCost:5.8,shippingCostVatIncluded:false,shippingVatRate:21,freeShippingThreshold:120,freeShippingThresholdBasis:"gross",
    deliveryZone:"ES_PENINSULA",observedAt:new Date().toISOString(),sourceStatus:"normal",sourceMode:"automatic"
  };
}
export function normalizeDentalCost(raw:DentalCostProductRaw):SupplierOffer[]{return raw.variants.map(v=>offer(raw,v)).filter(o=>o.regularPrice>0);}
