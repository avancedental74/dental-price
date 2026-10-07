import type { SupplierOffer } from "../../types/domain";
import type { PriceObservation } from "../history";

export type AnomalySeverity = "normal" | "suspicious" | "quarantined";

export interface AnomalyResult {
  severity: AnomalySeverity;
  reasons: string[];
}

export interface AnomalyInput {
  offer: SupplierOffer;
  previous?: PriceObservation;
}