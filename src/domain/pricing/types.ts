import type { Promotion, SupplierOffer } from "../../types/domain";

export interface PricingContext {
  requestedQuantity: number;
  includeVat: boolean;
}

export interface PricingBreakdown {
  supplierId: string;
  requestedQuantity: number;
  paidUnits: number;
  receivedUnits: number;
  baseUnitPrice: number;
  subtotalBeforeVat: number;
  discountAmount: number;
  promotionalSubtotal: number;
  vatAmount: number | null;
  subtotalWithVat: number;
  shippingCost: number | null;
  effectiveTotalCost: number;
  effectiveUnitCost: number;
  promotion?: Promotion;
  warnings: string[];
}

export interface PricedOffer {
  offer: SupplierOffer;
  pricing: PricingBreakdown;
}