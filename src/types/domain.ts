export type MatchStatus =
  | "EXACT"
  | "HIGH_CONFIDENCE"
  | "REVIEW_REQUIRED"
  | "REJECTED";

export type StockStatus =
  | "in_stock"
  | "low_stock"
  | "backorder"
  | "preorder"
  | "unavailable"
  | "unknown";

export type VatStatus = "included" | "excluded" | "unknown";
export type FreshnessStatus = "fresh" | "aging" | "stale";
export type ShippingThresholdBasis = "net" | "gross";

export interface CanonicalProduct {
  id: string;
  manufacturer: string;
  brand?: string;
  family: string;
  productName: string;
  variant?: string;
  shade?: string;
  presentation: string;
  quantity: number;
  unit: string;
  packCount: number;
  manufacturerReference?: string;
  eanGtin?: string;
  category: string;
  subcategory?: string;
  normalizedName: string;
  active: boolean;
}

export interface Promotion {
  type:
    | "percentage_discount"
    | "fixed_discount"
    | "buy_x_get_y"
    | "bundle"
    | "liquidation"
    | "coupon_public"
    | "free_shipping"
    | "other";
  description: string;
  minQty?: number;
  freeQty?: number;
  discountPercent?: number;
  discountAmount?: number;
  bundlePrice?: number;
  validUntil?: string;
}

export interface SupplierOffer {
  supplierId: string;
  supplierSku?: string;
  manufacturer?: string;
  manufacturerReference?: string;
  eanGtin?: string;
  rawName: string;
  normalizedName: string;
  productUrl: string;
  presentation?: string;
  quantity?: number;
  unit?: string;
  packCount?: number;
  variant?: string;
  shade?: string;
  stockStatus: StockStatus;
  rawStockText?: string;
  regularPrice: number;
  salePrice?: number;
  vatStatus: VatStatus;
  vatRate?: number;
  currency: "EUR";
  promotion?: Promotion;
  shippingCost?: number;
  shippingCostVatIncluded?: boolean;
  shippingVatRate?: number;
  freeShippingThreshold?: number;
  freeShippingThresholdBasis?: ShippingThresholdBasis;
  deliveryZone?: "ES_PENINSULA" | "ES_BALEARES" | "ES_CANARIAS" | "ES_CEUTA_MELILLA" | "OTHER";
  deliveryEstimate?: string;
  observedAt: string;
  sourceStatus: "normal" | "suspicious" | "quarantined";
  sourceMode?: "automatic" | "manual";
}