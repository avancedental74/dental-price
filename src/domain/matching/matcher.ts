import type { CanonicalProduct, SupplierOffer } from "../../types/domain";
import type { MatchReason, MatchResult } from "./types";
import {
  normalizeManufacturer,
  normalizeName,
  normalizePresentation,
  normalizeReference,
  normalizeShade,
  normalizeUnit
} from "./normalization";

function closeNumber(a?: number, b?: number): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.000001;
}

function addReason(reasons: MatchReason[], code: string, label: string, weight: number, matched: boolean) {
  reasons.push({ code, label, weight, matched });
}

function criticalMissing(product: CanonicalProduct, offer: SupplierOffer): string[] {
  const missing: string[] = [];
  if (product.variant && !offer.variant) missing.push("variant");
  if (product.shade && !offer.shade) missing.push("shade");
  if (product.presentation?.trim() && !offer.presentation) missing.push("presentation");
  if (Number.isFinite(product.quantity) && product.quantity > 0 && product.unit?.trim() && offer.quantity == null) missing.push("quantity");
  if (Number.isFinite(product.packCount) && product.packCount > 0 && offer.packCount == null) missing.push("packCount");
  return missing;
}

export function matchOfferToProduct(product: CanonicalProduct, offer: SupplierOffer): MatchResult {
  const reasons: MatchReason[] = [];
  const conflicts: string[] = [];
  let rawScore = 0;
  let possibleScore = 0;
  let hardReject = false;

  const productEan = normalizeReference(product.eanGtin);
  const offerEan = normalizeReference(offer.eanGtin);
  const productRef = normalizeReference(product.manufacturerReference);
  const offerRef = normalizeReference(offer.manufacturerReference);

  const exactEan = Boolean(productEan && offerEan && productEan === offerEan);
  const exactRef = Boolean(productRef && offerRef && productRef === offerRef);

  if (productEan) {
    possibleScore += 50;
    const matched = exactEan;
    addReason(reasons, "ean", "EAN/GTIN", 50, matched);
    if (matched) rawScore += 50;
    else if (offerEan) {
      hardReject = true;
      conflicts.push("EAN/GTIN contradictorio");
    }
  }

  if (productRef) {
    possibleScore += 40;
    const matched = exactRef;
    addReason(reasons, "manufacturer_reference", "Referencia fabricante", 40, matched);
    if (matched) rawScore += 40;
    else if (offerRef) {
      hardReject = true;
      conflicts.push("Referencia de fabricante contradictoria");
    }
  }

  possibleScore += 10;
  const pm = normalizeManufacturer(product.manufacturer);
  const om = normalizeManufacturer(offer.manufacturer);
  const manufacturerMatch = Boolean(pm && om && pm === om);
  addReason(reasons, "manufacturer", "Fabricante", 10, manufacturerMatch);
  if (manufacturerMatch) rawScore += 10;
  else if (pm && om && pm !== om) {
    hardReject = true;
    conflicts.push("Fabricante contradictorio");
  }

  possibleScore += 10;
  const familyMatch = normalizeName(offer.normalizedName).includes(normalizeName(product.family));
  addReason(reasons, "family", "Familia", 10, familyMatch);
  if (familyMatch) rawScore += 10;

  for (const [code, label, weight, expected, actual, normalizer] of [
    ["variant","Variante",10,product.variant,offer.variant,normalizeName],
    ["shade","Tono/color",10,product.shade,offer.shade,normalizeShade],
    ["presentation","Presentación",10,product.presentation,offer.presentation,normalizePresentation]
  ] as const) {
    if (!expected) continue;
    possibleScore += weight;
    const matched = Boolean(actual && normalizer(expected) === normalizer(actual));
    addReason(reasons, code, label, weight, matched);
    if (matched) rawScore += weight;
    else if (actual) {
      hardReject = true;
      conflicts.push(label === "Presentación" ? "Presentación contradictoria" : label === "Variante" ? "Variante contradictoria" : label + " contradictorio");
    }
  }

  const hasExpectedQuantity=Number.isFinite(product.quantity)&&product.quantity>0&&Boolean(product.unit?.trim());
  if(hasExpectedQuantity){
    possibleScore += 10;
    const quantityMatch = offer.quantity != null && closeNumber(product.quantity, offer.quantity) &&
      normalizeUnit(product.unit) === normalizeUnit(offer.unit);
    addReason(reasons, "quantity", "Cantidad", 10, quantityMatch);
    if (quantityMatch) rawScore += 10;
    else if (offer.quantity != null) {
      hardReject = true;
      conflicts.push("Cantidad o unidad incompatible");
    }
  }

  if(Number.isFinite(product.packCount)&&product.packCount>0){
    possibleScore += 10;
    const packMatch = offer.packCount != null && product.packCount === offer.packCount;
    addReason(reasons, "pack_count", "Número de unidades", 10, packMatch);
    if (packMatch) rawScore += 10;
    else if (offer.packCount != null) {
      hardReject = true;
      conflicts.push("Pack incompatible");
    }
  }

  const score = hardReject ? 0 : Math.round((rawScore / Math.max(1, possibleScore)) * 100);
  const missing = criticalMissing(product, offer);
  const strongIdentifier = exactEan || exactRef;

  let status: MatchResult["status"] = "REJECTED";
  if (!hardReject) {
    if (strongIdentifier && missing.length === 0) status = "EXACT";
    else if (strongIdentifier) status = "HIGH_CONFIDENCE";
    else if (score >= 90 && missing.length === 0 && manufacturerMatch && familyMatch) status = "HIGH_CONFIDENCE";
    else if (score >= 70) status = "REVIEW_REQUIRED";
  }

  if (missing.length) conflicts.push("Campos críticos ausentes: " + missing.join(", "));

  return {
    status,
    score,
    hardReject,
    reasons,
    conflicts,
    canonicalProductId: product.id,
    supplierId: offer.supplierId,
    supplierSku: offer.supplierSku
  };
}