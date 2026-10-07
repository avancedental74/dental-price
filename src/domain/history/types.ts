export interface PriceObservation {
  id: string;
  productId: string;
  supplierId: string;
  supplierSku?: string;
  observedAt: string;
  lastSeenAt: string;
  seenCount: number;
  regularPrice: number;
  salePrice?: number;
  effectivePrice?: number;
  stockStatus: string;
  shippingCost?: number;
  promotionSignature?: string;
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
}

export interface HistoryAppendResult {
  history: PriceObservation[];
  appended: boolean;
  compacted: boolean;
}