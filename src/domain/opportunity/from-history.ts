import type { PriceObservation } from "../history";
import { calculateHistoryStats } from "../history";
import { calculateOpportunityScore } from "./score";
import type { OpportunityScoreResult } from "./types";

export function opportunityFromHistory(
  history: PriceObservation[],
  options: {
    now?: Date;
    isFresh: boolean;
    inStock: boolean;
    hasActivePromotion: boolean;
  }
): OpportunityScoreResult {
  const now=options.now ?? new Date();
  const stats=calculateHistoryStats(history,now);
  return calculateOpportunityScore({
    stats,
    currentPrice:stats.currentPrice,
    isFresh:options.isFresh,
    inStock:options.inStock,
    hasActivePromotion:options.hasActivePromotion
  });
}