import type { MatchedSupplierOffer } from "../comparison/types";
import type { PriceObservation } from "./types";
import { appendObservation } from "./history";

export function persistComparisonHistory(
  history: PriceObservation[],
  items: MatchedSupplierOffer[]
): PriceObservation[] {
  let current=[...history];
  for(const item of items){
    const effective=item.pricing?.effectiveTotalCost;
    current=appendObservation(
      current,
      item.product.id,
      item.offer,
      effective
    ).history;
  }
  return current;
}