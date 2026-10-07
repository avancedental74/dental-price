import type { StockStatus, SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";
import type { DentaltixProductRaw, DentaltixVariantRaw } from "./types";

function normalizeStock(value?: string): StockStatus {
  if (!value) return "unknown";
  if (/no disponible|agotado/i.test(value)) return "unavailable";
  if (/solo quedan/i.test(value)) return "low_stock";
  if (/en stock|entrega|disponible/i.test(value)) return "in_stock";
  return "unknown";
}

function inferPresentation(value: string): string | undefined {
  if (/jeringa|\bjer\.|\bsyr\.?\b|syringe/i.test(value)) return "Jeringa";
  if (/\bcap\.|\bcaps?\.?\b|cápsul|capsul/i.test(value)) return "Cápsulas";
  if (/caja/i.test(value)) return "Caja";
  if (/kit/i.test(value)) return "Kit";
  return undefined;
}

function inferQuantity(value: string): { quantity?: number; unit?: string; packCount?: number } {
  const pack = value.match(/(?:caja de\s*)?(\d+)\s*(?:uds?|unidades|caps?\.?)/i);
  const metric = value.match(/(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(gr|g|ml)\b/i);
  return {
    quantity: metric ? Number(metric[1].replace(",", ".")) : undefined,
    unit: metric ? (metric[2].toLowerCase() === "gr" ? "g" : metric[2].toLowerCase()) : undefined,
    packCount: pack ? Number(pack[1]) : metric ? 1 : undefined
  };
}

function inferShade(value: string): string | undefined {
  return value.match(/\b(A\d(?:\.5)?|B\d(?:\.5)?|C\d(?:\.5)?|D\d(?:\.5)?)\b/i)?.[1]?.toUpperCase();
}

function inferVariant(value: string): string | undefined {
  if (/\bbody\b/i.test(value)) return "Body";
  if (/\bdentina\b|\bdentin\b|\bdentine\b/i.test(value)) return "Dentin";
  if (/\besmalte\b|\benamel\b|\bglaze\b/i.test(value)) return "Enamel";
  return undefined;
}

function filtek4910FromRef(ref?:string): {presentation?:string;quantity?:number;unit?:string;packCount?:number;variant?:string;shade?:string} {
  const match=ref?.match(/^4910([A-Z]+\d(?:\.5)?)([BDE])$/i);
  if(!match) return {};
  const opacity=match[2].toUpperCase();
  return {
    presentation:"Jeringa",quantity:3,unit:"g",packCount:1,
    variant:opacity==="B"?"Body":opacity==="D"?"Dentin":"Enamel",
    shade:match[1].toUpperCase()
  };
}

function variantToOffer(raw: DentaltixProductRaw, variant: DentaltixVariantRaw): SupplierOffer {
  const q = inferQuantity(variant.title);
  const byRef=filtek4910FromRef(variant.manufacturerReference);
  return {
    supplierId: "dentaltix",
    supplierSku: variant.supplierSku,
    manufacturer: raw.manufacturer,
    manufacturerReference: variant.manufacturerReference,
    rawName: variant.title,
    normalizedName: normalizeName([raw.title, variant.title, raw.manufacturer ?? ""].join(" ")),
    productUrl: variant.productUrl,
    presentation: inferPresentation(variant.title) ?? byRef.presentation,
    quantity: q.quantity ?? byRef.quantity,
    unit: q.unit ?? byRef.unit,
    packCount: q.packCount ?? byRef.packCount,
    variant: inferVariant(variant.title) ?? byRef.variant,
    shade: inferShade(variant.title) ?? byRef.shade,
    stockStatus: normalizeStock(variant.rawStockText),
    rawStockText: variant.rawStockText,
    regularPrice: variant.regularPrice ?? variant.salePrice ?? raw.regularPrice ?? raw.salePrice ?? 0,
    salePrice: variant.salePrice ?? raw.salePrice,
    vatStatus: typeof raw.vatRate === "number" ? "excluded" : "unknown",
    vatRate: raw.vatRate,
    currency: "EUR",
    shippingCost: 4.95,
    shippingCostVatIncluded: false,
    shippingVatRate: 21,
    freeShippingThreshold: 100,
    freeShippingThresholdBasis: "net",
    deliveryZone: "ES_PENINSULA",
    observedAt: new Date().toISOString(),
    sourceStatus: "normal",
    sourceMode: "automatic"
  };
}

export function normalizeDentaltix(raw: DentaltixProductRaw): SupplierOffer[] {
  if (raw.variants.length) return raw.variants.map(v => variantToOffer(raw, v)).filter(o => o.regularPrice > 0 || (o.salePrice ?? 0) > 0);
  const q = inferQuantity(raw.title);
  const byRef=filtek4910FromRef(raw.pageManufacturerReference);
  const single: SupplierOffer = {
    supplierId: "dentaltix",
    supplierSku: raw.pageSupplierSku,
    manufacturer: raw.manufacturer,
    manufacturerReference: raw.pageManufacturerReference,
    rawName: raw.title,
    normalizedName: normalizeName([raw.title, raw.manufacturer ?? ""].join(" ")),
    productUrl: raw.productUrl,
    presentation: inferPresentation(raw.title) ?? byRef.presentation,
    quantity: q.quantity ?? byRef.quantity,
    unit: q.unit ?? byRef.unit,
    packCount: q.packCount ?? byRef.packCount,
    variant: inferVariant(raw.title) ?? byRef.variant,
    shade: inferShade(raw.title) ?? byRef.shade,
    stockStatus: normalizeStock(raw.rawStockText),
    rawStockText: raw.rawStockText,
    regularPrice: raw.regularPrice ?? raw.salePrice ?? 0,
    salePrice: raw.salePrice,
    vatStatus: typeof raw.vatRate === "number" ? "excluded" : "unknown",
    vatRate: raw.vatRate,
    currency: "EUR",
    shippingCost: 4.95,
    shippingCostVatIncluded: false,
    shippingVatRate: 21,
    freeShippingThreshold: 100,
    freeShippingThresholdBasis: "net",
    deliveryZone: "ES_PENINSULA",
    observedAt: new Date().toISOString(),
    sourceStatus: "normal",
    sourceMode: "automatic"
  };
  return single.regularPrice > 0 || (single.salePrice ?? 0) > 0 ? [single] : [];
}