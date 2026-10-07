export interface PriceObservation {
  id: string;
  productId: string;
  supplierId: string;
  supplierSku?: string;
  observedAt: string;
  lastSeenAt: string;
  seenCount: number;
  requestedQuantity: number;
  regularPrice: number;
  salePrice?: number;
  effectiveUnitCost?: number;
  effectiveTotalCost?: number;
  stockStatus: string;
  shippingCost?: number;
  promotionSignature?: string;
  presentation?: string;
  quantity?: number;
  unit?: string;
  packCount?: number;
  sourceUrl: string;
}

export interface PriceHistoryStats {
  currentPrice: number | null;
  average30d: number | null;
  average90d: number | null;
  min90d: number | null;
  max90d: number | null;
  historicalMin: number | null;
  historicalMax: number | null;
  observations30d: number;
  observations90d: number;
  observationsTotal: number;
  coverageDays30: number;
  coverageDays90: number;
  coverageDaysTotal: number;
}

export interface HistoryAppendResult {
  history: PriceObservation[];
  appended: boolean;
  compacted: boolean;
}