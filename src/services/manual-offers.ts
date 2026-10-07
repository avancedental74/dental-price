import type { CanonicalProduct, SupplierOffer, StockStatus, VatStatus } from "../types/domain";
import type { PriceObservation } from "../domain/history";
import { supplierOfferSchema } from "../domain/schemas";
import { normalizeReference } from "../domain/matching/normalization";

const STORAGE_KEY="dental-price:manual-offers:v1";
const HISTORY_KEY="dental-price:manual-history:v1";

export interface ManualOfferInput {
  supplierId:"proclinic"|"dental-iberica";
  productUrl:string;
  manufacturerReference:string;
  price:number;
  vatStatus:VatStatus;
  vatRate?:number;
  stockStatus:StockStatus;
  shippingCost?:number;
  shippingCostVatIncluded?:boolean;
  shippingVatRate?:number;
  freeShippingThreshold?:number;
  freeShippingThresholdBasis?:"net"|"gross";
}

export function loadManualOffers():SupplierOffer[]{
  if(typeof window==="undefined") return [];
  try{
    const raw=JSON.parse(window.localStorage.getItem(STORAGE_KEY)??"[]");
    if(!Array.isArray(raw)) return [];
    return raw.flatMap(value=>{const parsed=supplierOfferSchema.safeParse(value);return parsed.success?[parsed.data]:[];});
  }catch{return [];}
}

export function loadManualHistory():PriceObservation[]{
  if(typeof window==="undefined") return [];
  try{
    const raw=JSON.parse(window.localStorage.getItem(HISTORY_KEY)??"[]");
    return Array.isArray(raw)?raw:[];
  }catch{return [];}
}

export function saveManualHistory(history:PriceObservation[]):void{
  if(typeof window==="undefined") return;
  window.localStorage.setItem(HISTORY_KEY,JSON.stringify(history));
}

export function saveManualOffers(offers:SupplierOffer[]):void{
  if(typeof window==="undefined") return;
  window.localStorage.setItem(STORAGE_KEY,JSON.stringify(offers));
}

export function buildManualOffer(product:CanonicalProduct,input:ManualOfferInput):SupplierOffer{
  if(!product.manufacturerReference) throw new Error("El producto no tiene referencia de fabricante");
  if(!Number.isFinite(input.price)||input.price<=0) throw new Error("El precio debe ser mayor que cero");
  const url=new URL(input.productUrl);
  if(url.protocol!=="https:"&&url.protocol!=="http:") throw new Error("La URL debe ser http/https");
  const hostname=url.hostname.toLowerCase().replace(/^www\./,"");
  const allowed=input.supplierId==="proclinic" ? hostname==="proclinic.es" || hostname.endsWith(".proclinic.es") : hostname==="dentaliberica.com" || hostname.endsWith(".dentaliberica.com");
  if(!allowed) throw new Error("La URL no pertenece al proveedor seleccionado");
  if(normalizeReference(input.manufacturerReference)!==normalizeReference(product.manufacturerReference)) throw new Error("La referencia de fabricante no coincide con el producto seleccionado");
  const offer:SupplierOffer={
    supplierId:input.supplierId,
    manufacturer:product.manufacturer,
    manufacturerReference:input.manufacturerReference.trim(),
    rawName:[product.family,product.shade,product.variant,product.presentation].filter(Boolean).join(" "),
    normalizedName:product.normalizedName,
    productUrl:url.toString(),
    presentation:product.presentation,
    quantity:product.quantity,
    unit:product.unit,
    packCount:product.packCount,
    variant:product.variant,
    shade:product.shade,
    stockStatus:input.stockStatus,
    regularPrice:input.price,
    vatStatus:input.vatStatus,
    vatRate:input.vatRate,
    currency:"EUR",
    shippingCost:input.shippingCost,
    shippingCostVatIncluded:input.shippingCostVatIncluded,
    shippingVatRate:input.shippingVatRate,
    freeShippingThreshold:input.freeShippingThreshold,
    freeShippingThresholdBasis:input.freeShippingThresholdBasis,
    deliveryZone:"ES_PENINSULA",
    observedAt:new Date().toISOString(),
    sourceStatus:"normal",
    sourceMode:"manual"
  };
  return supplierOfferSchema.parse(offer);
}

export function upsertManualOffer(offers:SupplierOffer[],next:SupplierOffer):SupplierOffer[]{
  return [...offers.filter(o=>!(o.supplierId===next.supplierId&&o.manufacturerReference===next.manufacturerReference)),next];
}