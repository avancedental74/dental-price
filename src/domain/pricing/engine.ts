import type { Promotion, SupplierOffer } from "../../types/domain";
import type { PricingBreakdown, PricingContext } from "./types";

function money(value:number):number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function unitPrice(offer:SupplierOffer):number {
  return offer.salePrice ?? offer.regularPrice;
}

function applyPromotion(unit:number,quantity:number,promotion?:Promotion){
  let paidUnits=quantity;
  let receivedUnits=quantity;
  let subtotal=unit*quantity;
  let discountAmount=0;
  const warnings:string[]=[];

  if(!promotion) return {paidUnits,receivedUnits,subtotal,discountAmount,warnings};

  switch(promotion.type){
    case "percentage_discount": {
      const pct=promotion.discountPercent ?? 0;
      if(pct>0 && pct<=100){
        discountAmount=subtotal*(pct/100);
        subtotal-=discountAmount;
      } else warnings.push("Descuento porcentual inválido o incompleto");
      break;
    }
    case "fixed_discount": {
      const fixed=(promotion as Promotion & { discountAmount?: number }).discountAmount ?? 0;
      discountAmount=Math.min(subtotal,Math.max(0,fixed));
      subtotal-=discountAmount;
      break;
    }
    case "buy_x_get_y": {
      const buy=promotion.minQty ?? 0;
      const free=promotion.freeQty ?? 0;
      if(buy>0 && free>0){
        const group=buy+free;
        const fullGroups=Math.floor(quantity/group);
        const remainder=quantity%group;
        paidUnits=fullGroups*buy+Math.min(remainder,buy);
        receivedUnits=quantity;
        subtotal=paidUnits*unit;
        discountAmount=(quantity-paidUnits)*unit;
      } else warnings.push("Promoción buy_x_get_y incompleta");
      break;
    }
    case "free_shipping":
    case "bundle":
    case "liquidation":
    case "coupon_public":
    case "other":
      break;
  }

  return {paidUnits,receivedUnits,subtotal,discountAmount,warnings};
}

function addVat(offer:SupplierOffer,subtotal:number,includeVat:boolean,warnings:string[]){
  if(!includeVat) return {vatAmount:0,total:subtotal};
  if(offer.vatStatus==="included") return {vatAmount:0,total:subtotal};
  if(offer.vatStatus==="excluded"){
    if(typeof offer.vatRate==="number"){
      const vat=subtotal*(offer.vatRate/100);
      return {vatAmount:vat,total:subtotal+vat};
    }
    warnings.push("IVA excluido pero tasa desconocida");
    return {vatAmount:null,total:subtotal};
  }
  warnings.push("IVA no confirmado");
  return {vatAmount:null,total:subtotal};
}

function shippingFor(offer:SupplierOffer,totalForThreshold:number,promotion?:Promotion):number|null {
  if(promotion?.type==="free_shipping") return 0;
  if(typeof offer.freeShippingThreshold==="number" && totalForThreshold>=offer.freeShippingThreshold) return 0;
  if(typeof offer.shippingCost==="number") return offer.shippingCost;
  return null;
}

export function calculatePricing(offer:SupplierOffer,context:PricingContext):PricingBreakdown {
  if(!Number.isInteger(context.requestedQuantity) || context.requestedQuantity<=0) throw new Error("requestedQuantity must be a positive integer");
  const base=unitPrice(offer);
  if(!Number.isFinite(base) || base<=0) throw new Error("Offer has no valid positive price");

  const promo=applyPromotion(base,context.requestedQuantity,offer.promotion);
  const warnings=[...promo.warnings];
  const subtotalBeforeVat=base*promo.paidUnits;
  const vat=addVat(offer,promo.subtotal,context.includeVat,warnings);
  const shipping=shippingFor(offer,vat.total,offer.promotion);
  if(shipping===null) warnings.push("Transporte no confirmado");
  const effectiveTotal=vat.total+(shipping ?? 0);

  return {
    supplierId:offer.supplierId,
    requestedQuantity:context.requestedQuantity,
    paidUnits:promo.paidUnits,
    receivedUnits:promo.receivedUnits,
    baseUnitPrice:money(base),
    subtotalBeforeVat:money(subtotalBeforeVat),
    discountAmount:money(promo.discountAmount),
    promotionalSubtotal:money(promo.subtotal),
    vatAmount:vat.vatAmount===null?null:money(vat.vatAmount),
    subtotalWithVat:money(vat.total),
    shippingCost:shipping===null?null:money(shipping),
    effectiveTotalCost:money(effectiveTotal),
    effectiveUnitCost:money(effectiveTotal/promo.receivedUnits),
    promotion:offer.promotion,
    warnings
  };
}