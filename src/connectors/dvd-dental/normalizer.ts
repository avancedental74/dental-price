import type { StockStatus, SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";
import type { DvdProductRaw, DvdVariantRaw } from "./types";
function stock(t?:string):StockStatus{if(!t)return"unknown";if(/sin stock|no disponible/i.test(t))return"unavailable";if(/(\d+)\s+en stock/i.test(t))return"low_stock";if(/disponible para compra|recíbelo mañana|en stock/i.test(t))return"in_stock";return"unknown";}
function variant(ref?:string,text=""):string|undefined{const s=ref?.match(/^4910.+([BDE])$/i)?.[1]?.toUpperCase();if(s==="B"||/body/i.test(text))return"Body";if(s==="D"||/dentina/i.test(text))return"Dentin";if(s==="E"||/esmalte/i.test(text))return"Enamel";}
function shade(ref?:string):string|undefined{return ref?.match(/^4910([A-Z]+\d(?:\.5)?)/i)?.[1]?.toUpperCase();}
function toOffer(raw:DvdProductRaw,v:DvdVariantRaw):SupplierOffer{
 const vatRate=v.netPrice&&v.grossPrice?Math.round(((v.grossPrice/v.netPrice)-1)*100):undefined;
 return {supplierId:"dvd-dental",supplierSku:v.supplierSku,manufacturer:raw.manufacturer,manufacturerReference:v.manufacturerReference,
 rawName:v.title,normalizedName:normalizeName([raw.title,v.title,raw.manufacturer??""].join(" ")),productUrl:v.productUrl,
 presentation:/jering/i.test(raw.title+" "+v.title)?"Jeringa":/compul|c[aá]psul/i.test(raw.title+" "+v.title)?"Cápsulas":undefined,
 quantity:/jering/i.test(raw.title+" "+v.title)?3:undefined,unit:/jering/i.test(raw.title+" "+v.title)?"g":undefined,packCount:/jering/i.test(raw.title+" "+v.title)?1:undefined,
 variant:variant(v.manufacturerReference,v.title),shade:shade(v.manufacturerReference),stockStatus:stock(v.stockText),rawStockText:v.stockText,
 regularPrice:v.netPrice??0,salePrice:v.netPrice,vatStatus:typeof vatRate==="number"?"excluded":"unknown",vatRate,currency:"EUR",
 shippingCost:6,shippingCostVatIncluded:false,shippingVatRate:21,freeShippingThreshold:110,freeShippingThresholdBasis:"net",
 deliveryZone:"ES_PENINSULA",observedAt:new Date().toISOString(),sourceStatus:"normal",sourceMode:"automatic"};
}
export function normalizeDvd(raw:DvdProductRaw):SupplierOffer[]{return raw.variants.map(v=>toOffer(raw,v)).filter(o=>o.regularPrice>0);}
