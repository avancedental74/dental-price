import type { ShippingThresholdBasis, SupplierOffer } from "../types/domain";

export interface SupplierPolicy {
  supplierId:string;
  zone:"ES_PENINSULA";
  shippingCost:number;
  shippingCostVatIncluded:boolean;
  shippingVatRate:number;
  freeShippingThreshold:number;
  freeShippingThresholdBasis:ShippingThresholdBasis;
  observedAt:string;
  sourceUrl:string;
}

export function applySupplierPolicy(offer:SupplierOffer,policy?:SupplierPolicy):SupplierOffer{
  if(!policy) return offer;
  return {
    ...offer,
    shippingCost:policy.shippingCost,
    shippingCostVatIncluded:policy.shippingCostVatIncluded,
    shippingVatRate:policy.shippingVatRate,
    freeShippingThreshold:policy.freeShippingThreshold,
    freeShippingThresholdBasis:policy.freeShippingThresholdBasis,
    deliveryZone:policy.zone
  };
}
