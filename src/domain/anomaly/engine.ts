import type { SupplierOffer } from "../../types/domain";
import type { PriceObservation } from "../history";
import type { AnomalyInput, AnomalyResult, AnomalySeverity } from "./types";

function effectivePrice(offer:SupplierOffer):number { return offer.salePrice ?? offer.regularPrice; }
function previousPrice(previous?:PriceObservation):number|undefined {
  return previous?.salePrice ?? previous?.regularPrice;
}
function worsen(current:AnomalySeverity,next:AnomalySeverity):AnomalySeverity {
  const rank={normal:0,suspicious:1,quarantined:2};
  return rank[next]>rank[current]?next:current;
}

export function analyzeOfferAnomaly(input:AnomalyInput):AnomalyResult {
  const {offer,previous}=input;
  const reasons:string[]=[];
  let severity:AnomalySeverity="normal";
  const current=effectivePrice(offer);

  if(!Number.isFinite(current) || current<=0){
    severity="quarantined";
    reasons.push("Precio no positivo o inválido");
    return {severity,reasons};
  }

  const prior=previousPrice(previous);
  if(prior && prior>0){
    const ratio=current/prior;
    if(ratio<=0.1 || ratio>=10){
      severity=worsen(severity,"quarantined");
      reasons.push("Cambio de precio por factor 10 o superior");
    } else if(ratio<0.5){
      severity=worsen(severity,"suspicious");
      reasons.push("Caída superior al 50% respecto a la observación previa");
    } else if(ratio>2){
      severity=worsen(severity,"suspicious");
      reasons.push("Subida superior al 100% respecto a la observación previa");
    }
  }

  if(previous){
    if(previous.presentation && offer.presentation && previous.presentation!==offer.presentation){
      severity=worsen(severity,"quarantined"); reasons.push("Cambio inesperado de presentación para el mismo SKU");
    }
    if(previous.unit && offer.unit && previous.unit!==offer.unit){
      severity=worsen(severity,"quarantined"); reasons.push("Cambio inesperado de unidad para el mismo SKU");
    }
    if(previous.packCount && offer.packCount && previous.packCount!==offer.packCount){
      severity=worsen(severity,"quarantined"); reasons.push("Cambio inesperado de pack para el mismo SKU");
    }
    if(previous.quantity && offer.quantity && Math.abs(previous.quantity-offer.quantity)>0.000001){
      severity=worsen(severity,"quarantined"); reasons.push("Cambio inesperado de cantidad para el mismo SKU");
    }
    if(previous.presentation && !offer.presentation){
      severity=worsen(severity,"suspicious"); reasons.push("Desapareció la presentación previamente conocida");
    }
    if(previous.unit && !offer.unit){
      severity=worsen(severity,"suspicious"); reasons.push("Desapareció la unidad previamente conocida");
    }
  }

  return {severity,reasons};
}

export function applyAnomalyStatus(offer:SupplierOffer,previous?:PriceObservation):SupplierOffer {
  const result=analyzeOfferAnomaly({offer,previous});
  // Existing source-level alarms (e.g. two live queries disagreeing on a price)
  // must not be silently cleared by a separate historical anomaly check.
  return {...offer,sourceStatus:worsen(offer.sourceStatus,result.severity)};
}