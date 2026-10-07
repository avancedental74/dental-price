import type { SupplierOffer } from "../../types/domain";

export function promotionSignature(offer: SupplierOffer): string | undefined {
  if (!offer.promotion) return undefined;
  const p=offer.promotion;
  return [p.type,p.description,p.minQty ?? "",p.freeQty ?? "",p.discountPercent ?? "",p.discountAmount ?? "",p.bundlePrice ?? "",p.validUntil ?? ""].join("|");
}

export function offerStateSignature(offer: SupplierOffer, effectiveUnitCost?: number, requestedQuantity=1): string {
  return JSON.stringify({
    requestedQuantity,
    regularPrice: offer.regularPrice,
    salePrice: offer.salePrice ?? null,
    effectiveUnitCost: effectiveUnitCost ?? null,
    stockStatus: offer.stockStatus,
    shippingCost: offer.shippingCost ?? null,
    promotion: promotionSignature(offer) ?? null,
    presentation: offer.presentation ?? null,
    quantity: offer.quantity ?? null,
    unit: offer.unit ?? null,
    packCount: offer.packCount ?? null
  });
}