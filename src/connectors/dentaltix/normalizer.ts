import type { StockStatus, SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";
import { knowledgeForReference } from "../../domain/catalog";
import { promotionForObservedPrices } from "../../domain/promotions";
import type { DentaltixProductRaw, DentaltixVariantRaw } from "./types";

function normalizeStock(value?: string): StockStatus {
  if (!value) return "unknown";
  if (/no disponible|agotado/i.test(value)) return "unavailable";
  if (/solo quedan/i.test(value)) return "low_stock";
  if (/en stock|entrega|disponible/i.test(value)) return "in_stock";
  return "unknown";
}
function inferPresentation(value:string):string|undefined{
  if(/jeringa|\bjer\.|\bsyr\.?\b|syringe/i.test(value)) return "Jeringa";
  if(/\bcap\.|\bcaps?\.?\b|cápsul|capsul/i.test(value)) return "Cápsulas";
  if(/caja|\bfresas?\b|\bpeeso\b/i.test(value)) return "Caja";
  if(/\bbote\b|\bfrasco\b|\bbotella\b/i.test(value)) return "Frasco";
  if(/kit/i.test(value)) return "Kit";
}
function inferQuantity(value:string):{quantity?:number;unit?:string;packCount?:number}{
  const units=value.match(/(?:caja de\s*)?(\d+)\s*(?:uds?|unidades)\b/i);
  const capsules=value.match(/(?:caja de\s*)?(\d+)\s*(?:caps?\.?|c[aá]psulas?)\b/i);
  const metric=value.match(/(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(gr|g|ml|mm)\b/i);
  if(metric&&metric[2].toLowerCase()==="mm"&&units) return {quantity:Number(metric[1].replace(",",".")),unit:"mm",packCount:Number(units[1])};
  if(units&&!metric) return {quantity:Number(units[1]),unit:"ud",packCount:1};
  return {quantity:metric?Number(metric[1].replace(",",".")):undefined,unit:metric?(metric[2].toLowerCase()==="gr"?"g":metric[2].toLowerCase()):undefined,packCount:capsules?Number(capsules[1]):metric?1:undefined};
}
function inferShade(value:string):string|undefined{return value.match(/\b(A\d(?:\.5)?|B\d(?:\.5)?|C\d(?:\.5)?|D\d(?:\.5)?)\b/i)?.[1]?.toUpperCase();}
function inferVariant(value:string):string|undefined{
  const peeso=value.match(/(?:n[ºo°]\s*|numero\s*)([1-6])\b/i)?.[1]; if(peeso) return "No"+peeso;
  const size=value.match(/(?:talla\s*:?\s*|\b)(XS|XL|XXL|S|M|L)\b/i)?.[1]?.toUpperCase(); if(size) return size;
  if(/\bbody\b/i.test(value)) return "Body";
  if(/\bdentina\b|\bdentin\b|\bdentine\b/i.test(value)) return "Dentin";
  if(/\besmalte\b|\benamel\b|\bglaze\b/i.test(value)) return "Enamel";
}

function variantToOffer(raw:DentaltixProductRaw,variant:DentaltixVariantRaw):SupplierOffer{
  const q=inferQuantity(variant.title);
  const known=knowledgeForReference(variant.manufacturerReference);
  return {
    supplierId:"dentaltix",supplierSku:variant.supplierSku,manufacturer:raw.manufacturer,manufacturerReference:variant.manufacturerReference,
    rawName:variant.title,normalizedName:normalizeName([raw.title,variant.title,raw.manufacturer??""].join(" ")),productUrl:variant.productUrl,
    presentation:known.presentation??inferPresentation(variant.title)??inferPresentation(raw.title),
    quantity:known.quantity??q.quantity,unit:known.unit??q.unit,packCount:known.packCount??q.packCount,
    variant:known.variant??inferVariant(variant.title),shade:known.shade??inferShade(variant.title),
    stockStatus:normalizeStock(variant.rawStockText),rawStockText:variant.rawStockText,
    regularPrice:variant.regularPrice??variant.salePrice??raw.regularPrice??raw.salePrice??0,
    salePrice:variant.salePrice??raw.salePrice,
    vatStatus:typeof raw.vatRate==="number"?"excluded":"unknown",vatRate:raw.vatRate,currency:"EUR",
    promotion:promotionForObservedPrices([variant.title,raw.title,raw.promotionText??""].join(" "),variant.regularPrice??raw.regularPrice,variant.salePrice??raw.salePrice),
    observedAt:new Date().toISOString(),sourceStatus:"normal",sourceMode:"automatic"
  };
}

export function normalizeDentaltix(raw:DentaltixProductRaw):SupplierOffer[]{
  if(raw.variants.length) return raw.variants.map(v=>variantToOffer(raw,v)).filter(o=>o.regularPrice>0||(o.salePrice??0)>0);
  const q=inferQuantity(raw.title), known=knowledgeForReference(raw.pageManufacturerReference);
  const single:SupplierOffer={
    supplierId:"dentaltix",supplierSku:raw.pageSupplierSku,manufacturer:raw.manufacturer,manufacturerReference:raw.pageManufacturerReference,
    rawName:raw.title,normalizedName:normalizeName([raw.title,raw.manufacturer??""].join(" ")),productUrl:raw.productUrl,
    presentation:known.presentation??inferPresentation(raw.title),quantity:known.quantity??q.quantity,unit:known.unit??q.unit,packCount:known.packCount??q.packCount,
    variant:known.variant??inferVariant(raw.title),shade:known.shade??inferShade(raw.title),
    stockStatus:normalizeStock(raw.rawStockText),rawStockText:raw.rawStockText,
    regularPrice:raw.regularPrice??raw.salePrice??0,salePrice:raw.salePrice,
    vatStatus:typeof raw.vatRate==="number"?"excluded":"unknown",vatRate:raw.vatRate,currency:"EUR",
    promotion:promotionForObservedPrices([raw.title,raw.promotionText??""].join(" "),raw.regularPrice,raw.salePrice),
    observedAt:new Date().toISOString(),sourceStatus:"normal",sourceMode:"automatic"
  };
  return single.regularPrice>0||(single.salePrice??0)>0?[single]:[];
}