import type { SupplierOffer } from "../../types/domain";

export function promotionSignature(offer: SupplierOffer): string | undefined {
  if (!offer.promotion) return undefined;
  const p=offer.promotion;
  return [p.type,p.description,p.minQty ?? "",p.freeQty ?? "",p.discountPercent ?? "",p.validUntil ?? ""].join("|");
}

export function offerStateSignature(offer: SupplierOffer, effectivePrice?: number): string {
  return JSON.stringify({
    regularPrice: offer.regularPrice,
    salePrice: offer.salePrice ?? null,
    effectivePrice: effectivePrice ?? null,
    stockStatus: offer.stockStatus,
    shippingCost: offer.shippingCost ?? null,
    promotion: promotionSignature(offer) ?? null
  });
}