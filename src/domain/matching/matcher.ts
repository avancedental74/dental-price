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

function eq(a?: string, b?: string): boolean {
  return Boolean(a && b && a === b);
}

function normalizedEq(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return normalizeName(a) === normalizeName(b);
}

function closeNumber(a?: number, b?: number): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.000001;
}

function addReason(
  reasons: MatchReason[],
  code: string,
  label: string,
  weight: number,
  matched: boolean
) {
  reasons.push({ code, label, weight, matched });
}

export function matchOfferToProduct(
  product: CanonicalProduct,
  offer: SupplierOffer
): MatchResult {
  const reasons: MatchReason[] = [];
  const conflicts: string[] = [];
  let rawScore = 0;
  let hardReject = false;

  const productEan = normalizeReference(product.eanGtin);
  const offerEan = normalizeReference(offer.eanGtin);
  const productRef = normalizeReference(product.manufacturerReference);
  const offerRef = normalizeReference(offer.manufacturerReference);

  if (productEan && offerEan) {
    const matched = productEan === offerEan;
    addReason(reasons, "ean", "EAN/GTIN", 50, matched);
    if (matched) rawScore += 50;
    else {
      hardReject = true;
      conflicts.push("EAN/GTIN contradictorio");
    }
  }

  if (productRef && offerRef) {
    const matched = productRef === offerRef;
    addReason(reasons, "manufacturer_reference", "Referencia fabricante", 40, matched);
    if (matched) rawScore += 40;
    else {
      hardReject = true;
      conflicts.push("Referencia de fabricante contradictoria");
    }
  }

  const pm = normalizeManufacturer(product.manufacturer);
  const om = normalizeManufacturer(offer.rawName.includes("3M") && !offer.normalizedName.includes("solventum") ? "3M" : undefined);
  const offerManufacturer = om ?? normalizeManufacturer(
    offer.normalizedName.includes("solventum") ? "solventum" : undefined
  );

  if (pm && offerManufacturer) {
    const matched = pm === offerManufacturer;
    addReason(reasons, "manufacturer", "Fabricante", 10, matched);
    if (matched) rawScore += 10;
  }

  const familyMatch = normalizedEq(product.family, offer.normalizedName) ||
    normalizeName(offer.normalizedName).includes(normalizeName(product.family));
  addReason(reasons, "family", "Familia", 10, familyMatch);
  if (familyMatch) rawScore += 10;

  if (product.variant && offer.variant) {
    const matched = normalizeName(product.variant) === normalizeName(offer.variant);
    addReason(reasons, "variant", "Variante", 10, matched);
    if (matched) rawScore += 10;
    else {
      hardReject = true;
      conflicts.push("Variante contradictoria");
    }
  }

  if (product.shade && offer.shade) {
    const matched = normalizeShade(product.shade) === normalizeShade(offer.shade);
    addReason(reasons, "shade", "Tono/color", 10, matched);
    if (matched) rawScore += 10;
    else {
      hardReject = true;
      conflicts.push("Tono/color contradictorio");
    }
  }

  if (product.presentation && offer.presentation) {
    const matched =
      normalizePresentation(product.presentation) === normalizePresentation(offer.presentation);
    addReason(reasons, "presentation", "Presentación", 10, matched);
    if (matched) rawScore += 10;
    else {
      hardReject = true;
      conflicts.push("Presentación contradictoria");
    }
  }

  if (offer.quantity != null) {
    const sameUnit = normalizeUnit(product.unit) === normalizeUnit(offer.unit);
    const sameQuantity = closeNumber(product.quantity, offer.quantity);
    const matched = sameUnit && sameQuantity;
    addReason(reasons, "quantity", "Cantidad", 10, matched);
    if (matched) rawScore += 10;
    else {
      hardReject = true;
      conflicts.push("Cantidad o unidad incompatible");
    }
  }

  if (offer.packCount != null) {
    const matched = product.packCount === offer.packCount;
    addReason(reasons, "pack_count", "Número de unidades", 10, matched);
    if (matched) rawScore += 10;
    else {
      hardReject = true;
      conflicts.push("Pack incompatible");
    }
  }

  const maxPossible = reasons.reduce((sum, r) => sum + r.weight, 0) || 1;
  const score = hardReject ? 0 : Math.round((rawScore / maxPossible) * 100);

  let status: MatchResult["status"] = "REJECTED";
  if (!hardReject) {
    if (score >= 95) status = "EXACT";
    else if (score >= 85) status = "HIGH_CONFIDENCE";
    else if (score >= 70) status = "REVIEW_REQUIRED";
  }

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
