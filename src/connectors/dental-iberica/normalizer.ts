import type { StockStatus, SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";
import type { DentalIbericaProductRaw, DentalIbericaVariantRaw } from "./types";

function stock(value?:string):StockStatus{
  if(!value) return "unknown";
  if(/sin stock/i.test(value)) return "unavailable";
  if(/en stock/i.test(value)) return "in_stock";
  return "unknown";
}

function presentation(value:string):string|undefined{
  if(/cápsul|capsul/i.test(value)) return "Cápsulas";
  if(/jeringa/i.test(value)) return "Jeringa";
  if(/frasco/i.test(value)) return "Frasco";
  if(/caja/i.test(value)) return "Caja";
  if(/bolsa/i.test(value)) return "Bolsa";
  if(/saco/i.test(value)) return "Saco";
  if(/kit/i.test(value)) return "Kit";
  return undefined;
}

function metrics(value:string){
  const pack=value.match(/(?:x\s*)?(\d+)\s*(?:uds?\.?|unidades|cápsulas|capsulas|fresas|frascos|pares)\b/i);
  const metric=value.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|mm)\b/i);
  return {
    packCount:pack?Number(pack[1]):undefined,
    quantity:metric?Number(metric[1].replace(",",".")):undefined,
    unit:metric?(metric[2].toLowerCase()==="gr"?"g":metric[2].toLowerCase()):undefined
  };
}

function shade(value:string):string|undefined{
  return value.match(/\b(A\d(?:[.,]5)?|B\d(?:[.,]5)?|C\d(?:[.,]5)?|D\d(?:[.,]5)?|UD)\b/i)?.[1]?.replace(",",".").toUpperCase();
}

function variant(value:string):string|undefined{
  const size=value.match(/\b(XS|S|M|L|XL|Grandes?|Medianas?|Pequeñas?)\b/i)?.[1];
  if(size) return size.charAt(0).toUpperCase()+size.slice(1).toLowerCase();
  const no=value.match(/\bNo\s*(\d+)\b/i)?.[1];
  if(no) return "No"+no;
  const color=value.match(/\b(Rosa|Verde|Morado|Blanco|Gris|Negro|Azul|Amarillo|Naranja)\b/i)?.[1];
  if(color) return color.charAt(0).toUpperCase()+color.slice(1).toLowerCase();
  const flavor=value.match(/\b(Limón|Cola|Surtido|Frambuesa|Neutro|Menta)\b/i)?.[1];
  if(flavor) return flavor;
  return undefined;
}

function createOffer(raw:DentalIbericaProductRaw,item:DentalIbericaVariantRaw):SupplierOffer{
  const source=[raw.title,item.title,raw.contentText].filter(Boolean).join(" ");
  const m=metrics(source);
  return {
    supplierId:"dental-iberica",supplierSku:item.supplierSku,manufacturerReference:item.manufacturerReference,
    rawName:item.title,normalizedName:normalizeName([raw.title,item.title,raw.manufacturer ?? ""].join(" ")),productUrl:item.productUrl,
    presentation:presentation(source),quantity:m.quantity,unit:m.unit,packCount:m.packCount,variant:variant(item.title),shade:shade([item.title,item.manufacturerReference ?? ""].join(" ")),
    stockStatus:stock(item.rawStockText),rawStockText:item.rawStockText,regularPrice:item.price ?? 0,
    vatStatus:"unknown",currency:"EUR",observedAt:new Date().toISOString(),sourceStatus:"normal"
  };
}

export function normalizeDentalIberica(raw:DentalIbericaProductRaw):SupplierOffer[]{
  return raw.variants.map(v=>createOffer(raw,v)).filter(o=>o.regularPrice>0);
}