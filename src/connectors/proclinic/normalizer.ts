import type { StockStatus, SupplierOffer, VatStatus } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";
import type { ProclinicProductRaw, ProclinicVariantRaw } from "./types";

function stock(value?: string): StockStatus {
  if (!value) return "unknown";
  if (/agotado|no disponible/i.test(value)) return "unavailable";
  if (/entrega|stock|disponible/i.test(value)) return "in_stock";
  return "unknown";
}

function inferPresentation(value: string): string | undefined {
  if (/jeringa/i.test(value)) return "Jeringa";
  if (/cápsul|capsul/i.test(value)) return "Cápsulas";
  if (/caja/i.test(value)) return "Caja";
  if (/envase/i.test(value)) return "Envase";
  if (/kit/i.test(value)) return "Kit";
  return undefined;
}

function inferMetrics(value: string) {
  const pack=value.match(/(\d+)\s*(?:unidades|uds\.?|cápsulas|capsulas|carpules|jeringas?)/i);
  const metric=value.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|ml)\b/i);
  return {
    packCount:pack ? Number(pack[1]) : undefined,
    quantity:metric ? Number(metric[1].replace(",",".")) : undefined,
    unit:metric ? (metric[2].toLowerCase()==="gr" ? "g" : metric[2].toLowerCase()) : undefined
  };
}

function shade(value: string): string | undefined {
  return value.match(/\b(A\d(?:[.,]5)?|B\d(?:[.,]5)?|C\d(?:[.,]5)?|D\d(?:[.,]5)?)\b/i)?.[1]?.replace(",",".").toUpperCase();
}

function variant(value: string): string | undefined {
  if (/\bbody\b/i.test(value)) return "Body";
  if (/dentina|dentin/i.test(value)) return "Dentin";
  if (/esmalte|enamel/i.test(value)) return "Enamel";
  if (/translúcido|translucido|translucent/i.test(value)) return "Translucent";
  const size=value.match(/TALLA\s*(XS|S|M|L|XL)\b/i)?.[1];
  return size ? "Talla "+size.toUpperCase() : undefined;
}

function vatInfo(net?: number, gross?: number): { status: VatStatus; rate?: number } {
  if (!net || !gross || gross < net) return {status:"unknown"};
  const rawRate=((gross/net)-1)*100;
  const allowed=[4,10,21];
  const nearest=allowed.reduce((best,current)=>Math.abs(current-rawRate)<Math.abs(best-rawRate)?current:best,allowed[0]);
  if(Math.abs(nearest-rawRate)>0.35) return {status:"unknown"};
  return {status:"excluded", rate:nearest};
}

function createOffer(raw: ProclinicProductRaw, item?: ProclinicVariantRaw): SupplierOffer {
  const source=[raw.title,raw.contentText,item?.title].filter(Boolean).join(" ");
  const metrics=inferMetrics(source);
  const regular=item?.regularPrice ?? raw.regularPrice ?? item?.salePrice ?? raw.salePrice ?? 0;
  const sale=item?.salePrice ?? raw.salePrice;
  const vat=vatInfo(sale ?? regular, item?.vatIncludedPrice ?? raw.vatIncludedPrice);
  return {
    supplierId:"proclinic", supplierSku:item?.supplierSku ?? raw.pageSupplierSku,
    manufacturer:raw.manufacturer,
    manufacturerReference:item?.manufacturerReference ?? raw.pageManufacturerReference,
    rawName:item?.title ?? raw.title, normalizedName:normalizeName([raw.title,source,raw.manufacturer ?? ""].join(" ")),
    productUrl:item?.productUrl ?? raw.productUrl, presentation:inferPresentation(source),
    quantity:metrics.quantity, unit:metrics.unit, packCount:metrics.packCount, variant:variant(source), shade:shade(source),
    stockStatus:stock(item?.rawStockText ?? raw.rawStockText), rawStockText:item?.rawStockText ?? raw.rawStockText,
    regularPrice:regular, salePrice:sale, vatStatus:vat.status, vatRate:vat.rate, currency:"EUR",
    shippingCost:6,
    shippingCostVatIncluded:false,
    shippingVatRate:21,
    freeShippingThreshold:raw.freeShippingThreshold ?? 110,
    freeShippingThresholdBasis:"net",
    deliveryZone:"ES_PENINSULA",
    deliveryEstimate:raw.rawStockText,
    observedAt:new Date().toISOString(), sourceStatus:"normal"
  };
}

export function normalizeProclinic(raw: ProclinicProductRaw): SupplierOffer[] {
  const offers=raw.variants.length ? raw.variants.map(v=>createOffer(raw,v)) : [createOffer(raw)];
  return offers.filter(o=>o.regularPrice>0 || (o.salePrice ?? 0)>0);
}