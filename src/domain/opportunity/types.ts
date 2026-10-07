import type { PriceHistoryStats } from "../history";

export type OpportunityLabel = "muy_caro" | "caro" | "normal" | "buen_precio" | "precio_excepcional" | "insuficiente";

export interface OpportunityInput {
  stats: PriceHistoryStats;
  currentPrice: number | null;
  isFresh: boolean;
  inStock: boolean;
  hasActivePromotion: boolean;
}

export interface OpportunityBreakdown {
  vsAverage30: number | null;
  vsAverage90: number | null;
  position90: number | null;
  distanceToHistoricalMin: number | null;
  promotionBonus: number;
  freshnessAdjustment: number;
  stockAdjustment: number;
  confidence: number;
}

export interface OpportunityScoreResult {
  score: number | null;
  label: OpportunityLabel;
  sufficientData: boolean;
  breakdown: OpportunityBreakdown;
  reasons: string[];
}