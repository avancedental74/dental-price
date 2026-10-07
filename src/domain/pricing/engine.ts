import type { Promotion, SupplierOffer } from "../../types/domain";
import type { PricingBreakdown, PricingContext } from "./types";

function toCents(value:number):number { return Math.round(value*100); }
function fromCents(value:number):number { return value/100; }
function unitPrice(offer:SupplierOffer):number { return offer.salePrice ?? offer.regularPrice; }

function applyPromotion(unitCents:number,quantity:number,promotion?:Promotion){
  let paidUnits=quantity, receivedUnits=quantity, subtotalCents=unitCents*quantity, discountCents=0;
  const warnings:string[]=[];
  if(!promotion) return {paidUnits,receivedUnits,subtotalCents,discountCents,warnings};

  switch(promotion.type){
    case "percentage_discount": {
      const pct=promotion.discountPercent ?? 0;
      if(pct>0 && pct<=100){
        discountCents=Math.round(subtotalCents*(pct/100));
        subtotalCents-=discountCents;
      } else warnings.push("Descuento porcentual inválido o incompleto");
      break;
    }
    case "fixed_discount": {
      const fixedCents=toCents(promotion.discountAmount ?? 0);
      if(fixedCents>0){
        discountCents=Math.min(subtotalCents,fixedCents);
        subtotalCents-=discountCents;
      } else warnings.push("Descuento fijo inválido o incompleto");
      break;
    }
    case "buy_x_get_y": {
      const buy=promotion.minQty ?? 0, free=promotion.freeQty ?? 0;
      if(buy>0 && free>0){
        const group=buy+free;
        const fullGroups=Math.floor(quantity/group);
        const remainder=quantity%group;
        paidUnits=fullGroups*buy+Math.min(remainder,buy);
        receivedUnits=quantity;
        subtotalCents=paidUnits*unitCents;
        discountCents=(quantity-paidUnits)*unitCents;
      } else warnings.push("Promoción buy_x_get_y incompleta");
      break;
    }
    case "bundle": {
      const bundleQty=promotion.minQty ?? 0;
      const bundlePriceCents=toCents(promotion.bundlePrice ?? 0);
      if(bundlePriceCents>0 && bundleQty>0 && quantity%bundleQty===0){
        const before=subtotalCents;
        subtotalCents=(quantity/bundleQty)*bundlePriceCents;
        discountCents=Math.max(0,before-subtotalCents);
      } else warnings.push("Bundle no aplicable a la cantidad o incompleto");
      break;
    }
    case "free_shipping": break;
    case "liquidation":
    case "coupon_public":
    case "other":
      warnings.push("Promoción informativa no aplicada automáticamente");
      break;
  }
  return {paidUnits,receivedUnits,subtotalCents,discountCents,warnings};
}

function addVat(offer:SupplierOffer,subtotalCents:number,includeVat:boolean,warnings:string[]){
  if(!includeVat) return {vatCents:0,totalCents:subtotalCents,netCents:subtotalCents};
  if(offer.vatStatus==="included"){
    if(typeof offer.vatRate==="number"){
      const netCents=Math.round(subtotalCents/(1+offer.vatRate/100));
      return {vatCents:subtotalCents-netCents,totalCents:subtotalCents,netCents};
    }
    return {vatCents:0,totalCents:subtotalCents,netCents:subtotalCents};
  }
  if(offer.vatStatus==="excluded"){
    if(typeof offer.vatRate==="number"){
      const vatCents=Math.round(subtotalCents*(offer.vatRate/100));
      return {vatCents,totalCents:subtotalCents+vatCents,netCents:subtotalCents};
    }
    warnings.push("IVA excluido pero tasa desconocida");
    return {vatCents:null,totalCents:subtotalCents,netCents:subtotalCents};
  }
  warnings.push("IVA no confirmado");
  return {vatCents:null,totalCents:subtotalCents,netCents:subtotalCents};
}

function shippingCentsFor(offer:SupplierOffer,netCents:number,grossCents:number,promotion?:Promotion):number|null {
  if(promotion?.type==="free_shipping") return 0;
  if(typeof offer.freeShippingThreshold==="number"){
    const thresholdCents=toCents(offer.freeShippingThreshold);
    const comparable=(offer.freeShippingThresholdBasis ?? "net")==="net"?netCents:grossCents;
    if(comparable>=thresholdCents) return 0;
  }
  if(typeof offer.shippingCost!=="number") return null;
  const shippingCents=toCents(offer.shippingCost);
  if(offer.shippingCostVatIncluded!==false) return shippingCents;
  if(typeof offer.shippingVatRate==="number") return shippingCents+Math.round(shippingCents*(offer.shippingVatRate/100));
  return null;
}

export function calculatePricing(offer:SupplierOffer,context:PricingContext):PricingBreakdown {
  if(!Number.isInteger(context.requestedQuantity) || context.requestedQuantity<=0) throw new Error("requestedQuantity must be a positive integer");
  const base=unitPrice(offer);
  if(!Number.isFinite(base) || base<=0) throw new Error("Offer has no valid positive price");

  const baseCents=toCents(base);
  const promo=applyPromotion(baseCents,context.requestedQuantity,offer.promotion);
  const warnings=[...promo.warnings];
  const subtotalBeforeVatCents=baseCents*promo.paidUnits;
  const vat=addVat(offer,promo.subtotalCents,context.includeVat,warnings);
  const shippingCents=shippingCentsFor(offer,vat.netCents,vat.totalCents,offer.promotion);
  if(shippingCents===null) warnings.push("Transporte no confirmado");
  const effectiveTotalCents=vat.totalCents+(shippingCents ?? 0);

  return {
    supplierId:offer.supplierId,
    requestedQuantity:context.requestedQuantity,
    paidUnits:promo.paidUnits,
    receivedUnits:promo.receivedUnits,
    baseUnitPrice:fromCents(baseCents),
    subtotalBeforeVat:fromCents(subtotalBeforeVatCents),
    discountAmount:fromCents(promo.discountCents),
    promotionalSubtotal:fromCents(promo.subtotalCents),
    vatAmount:vat.vatCents===null?null:fromCents(vat.vatCents),
    subtotalWithVat:fromCents(vat.totalCents),
    shippingCost:shippingCents===null?null:fromCents(shippingCents),
    effectiveTotalCost:fromCents(effectiveTotalCents),
    effectiveUnitCost:fromCents(Math.round(effectiveTotalCents/promo.receivedUnits)),
    promotion:offer.promotion,
    warnings
  };
}