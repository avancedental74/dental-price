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
  if (/caja|\bfresas?\b|\bpeeso\b/i.test(value)) return "Caja";
  if (/\bbote\b|\bfrasco\b|\bbotella\b/i.test(value)) return "Frasco";
  if (/kit/i.test(value)) return "Kit";
  return undefined;
}

function inferQuantity(value: string): { quantity?: number; unit?: string; packCount?: number } {
  const units = value.match(/(?:caja de\s*)?(\d+)\s*(?:uds?|unidades)\b/i);
  const capsules = value.match(/(?:caja de\s*)?(\d+)\s*(?:caps?\.?|c[aá]psulas?)\b/i);
  const metric = value.match(/(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(gr|g|ml|mm)\b/i);
  if (metric && metric[2].toLowerCase()==="mm" && units) return { quantity:Number(metric[1].replace(",",".")), unit:"mm", packCount:Number(units[1]) };
  if (units && !metric) return { quantity:Number(units[1]), unit:"ud", packCount:1 };
  return {
    quantity: metric ? Number(metric[1].replace(",", ".")) : undefined,
    unit: metric ? (metric[2].toLowerCase() === "gr" ? "g" : metric[2].toLowerCase()) : undefined,
    packCount: capsules ? Number(capsules[1]) : metric ? 1 : undefined
  };
}

function inferShade(value: string): string | undefined {
  return value.match(/\b(A\d(?:\.5)?|B\d(?:\.5)?|C\d(?:\.5)?|D\d(?:\.5)?)\b/i)?.[1]?.toUpperCase();
}

function inferVariant(value: string): string | undefined {
  const peeso=value.match(/(?:n[ºo°]\s*|numero\s*)([1-6])\b/i)?.[1];
  if(peeso) return "No"+peeso;
  const size=value.match(/(?:talla\s*:?\s*|\b)(XS|XL|XXL|S|M|L)\b/i)?.[1]?.toUpperCase();
  if(size) return size;
  if (/\bbody\b/i.test(value)) return "Body";
  if (/\bdentina\b|\bdentin\b|\bdentine\b/i.test(value)) return "Dentin";
  if (/\besmalte\b|\benamel\b|\bglaze\b/i.test(value)) return "Enamel";
  return undefined;
}

function filtekFromRef(ref?:string): {presentation?:string;quantity?:number;unit?:string;packCount?:number;variant?:string;shade?:string} {
  const xte=ref?.match(/^4910([A-Z]+\d(?:\.5)?)([BDE])$/i);
  if(xte){
    const opacity=xte[2].toUpperCase();
    return {presentation:"Jeringa",quantity:3,unit:"g",packCount:1,variant:opacity==="B"?"Body":opacity==="D"?"Dentin":"Enamel",shade:xte[1].toUpperCase()};
  }
  const z250Syringe=ref?.match(/^6020([A-Z]\d(?:\.5)?)$/i);
  if(z250Syringe) return {presentation:"Jeringa",quantity:4,unit:"g",packCount:1,shade:z250Syringe[1].toUpperCase()};
  const z250Capsule=ref?.match(/^6021([A-Z]\d(?:\.5)?|UD)$/i);
  if(z250Capsule) return {presentation:"Cápsulas",quantity:0.2,unit:"g",packCount:20,variant:"Capsule",shade:z250Capsule[1].toUpperCase()};
  const filtekUniversal=ref?.match(/^6555(A1|A2|A3|A3\.5|A4|B1|B2|D3|XW|PO)$/i);
  if(filtekUniversal) return {presentation:"Jeringa",quantity:4,unit:"g",packCount:1,shade:filtekUniversal[1].toUpperCase()};
  if(ref==="4242") return {presentation:"Frasco",quantity:6,unit:"ml",packCount:1};
  if(ref==="41294") return {presentation:"Frasco",quantity:5,unit:"ml",packCount:1};
  const relyx:Record<string,string>={"56971":"Translucido","56972":"A1","56973":"AO3","56974":"WO"};
  if(ref && relyx[ref]) return {presentation:"Jeringa",quantity:3.4,unit:"g",packCount:1,shade:relyx[ref]};
  return {};
}

function variantToOffer(raw: DentaltixProductRaw, variant: DentaltixVariantRaw): SupplierOffer {
  const q = inferQuantity(variant.title);
  const byRef=filtekFromRef(variant.manufacturerReference);
  return {
    supplierId: "dentaltix",
    supplierSku: variant.supplierSku,
    manufacturer: raw.manufacturer,
    manufacturerReference: variant.manufacturerReference,
    rawName: variant.title,
    normalizedName: normalizeName([raw.title, variant.title, raw.manufacturer ?? ""].join(" ")),
    productUrl: variant.productUrl,
    presentation: byRef.presentation ?? inferPresentation(variant.title) ?? inferPresentation(raw.title),
    quantity: byRef.quantity ?? q.quantity,
    unit: byRef.unit ?? q.unit,
    packCount: byRef.packCount ?? q.packCount,
    variant: byRef.variant ?? inferVariant(variant.title),
    shade: byRef.shade ?? inferShade(variant.title),
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
  const byRef=filtekFromRef(raw.pageManufacturerReference);
  const single: SupplierOffer = {
    supplierId: "dentaltix",
    supplierSku: raw.pageSupplierSku,
    manufacturer: raw.manufacturer,
    manufacturerReference: raw.pageManufacturerReference,
    rawName: raw.title,
    normalizedName: normalizeName([raw.title, raw.manufacturer ?? ""].join(" ")),
    productUrl: raw.productUrl,
    presentation: byRef.presentation ?? inferPresentation(raw.title),
    quantity: byRef.quantity ?? q.quantity,
    unit: byRef.unit ?? q.unit,
    packCount: byRef.packCount ?? q.packCount,
    variant: byRef.variant ?? inferVariant(raw.title),
    shade: byRef.shade ?? inferShade(raw.title),
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