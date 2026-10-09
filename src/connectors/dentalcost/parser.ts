import * as cheerio from "cheerio";
import type { DentalCostProductRaw, DentalCostVariantRaw } from "./types";

function euro(value?:string):number|undefined{
  if(!value) return undefined;
  const n=Number(value.replace(/\s/g,"").replace(/€/g,"").replace(/\./g,"").replace(",",".").replace(/[^0-9.]/g,""));
  return Number.isFinite(n)?n:undefined;
}
function clean(value:string):string{return value.replace(/\s+/g," ").trim();}
function stripTags(value:string):string{
  return clean(value
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/g," ")
    .replace(/&amp;/g,"&")
    .replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'"));
}
function h1(html:string):string|undefined{
  const match=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match?stripTags(match[1]):undefined;
}

export function parseDentalCostProductHtmlFast(html:string,productUrl:string):DentalCostProductRaw|undefined{
  const body=stripTags(html);
  const title=h1(html)||"Producto DentalCost";
  const manufacturer=body.match(/(?:^|\s)(Solventum|3M ESPE|Medicaline|Starline|Cuatrogasa)(?:\s|$)/i)?.[1];
  const gross=body.match(/Precio con IVA\s*\((\d+(?:[.,]\d+)?)%\)\s*(\d+(?:[.,]\d+)?)\s*â‚¬/i);
  const net=body.match(/Precio sin IVA\s*(\d+(?:[.,]\d+)?)\s*â‚¬/i);
  const crossed=body.match(/-(\d+)%\s*(\d+(?:[.,]\d+)?)\s*â‚¬/i);
  const vatRate=gross?Number(gross[1].replace(",",".")):undefined;
  const salePrice=net?euro(net[1]):undefined;
  const regularPrice=crossed?euro(crossed[2]):salePrice;
  const promoIndex=body.search(/(?:Oferta|Promoci[oÃ³]n|Descuento|Compra|EnvÃ­o gratis)/i);
  const promotionText=promoIndex>=0?body.slice(promoIndex,promoIndex+600):undefined;

  const variants:DentalCostVariantRaw[]=[];
  const seen=new Set<string>();
  const re=/([^]{0,220}?)Ref:\s*([A-Za-z0-9._/-]+)\s*Ref\s*fabricante:\s*([A-Za-z0-9._/-]+)\s*Disponibilidad:\s*([^â‚¬]{1,80}?)\s*(\d+(?:[.,]\d+)?)\s*â‚¬/gi;
  for(const m of body.matchAll(re)){
    const ref=m[3].trim();
    if(ref==="0"||seen.has(ref))continue;
    seen.add(ref);
    variants.push({
      title:clean(m[1]).slice(-180),
      supplierSku:m[2].trim(),
      manufacturerReference:ref,
      stockText:clean(m[4]),
      price:euro(m[5]),
      productUrl
    });
  }

  const mainSku=body.match(/(?:Referencia|Ref):\s*([A-Za-z0-9._/-]+)/i)?.[1];
  const mainManufacturerRef=body.match(/Ref\.?\s*Fabricante:\s*([A-Za-z0-9._/-]+)/i)?.[1];
  if(mainManufacturerRef&&mainManufacturerRef!=="0"&&!seen.has(mainManufacturerRef)&&salePrice){
    const stockText=body.match(/Disponibilidad:\s*((?:\d+\s*(?:uds?|art(?:Ã­culo)?s?)\s*(?:disponible)?|Fuera de stock|Sin stock|Agotado))/i)?.[1]
      ??body.match(/Disponibilidad:\s*([^â‚¬]{1,120}?)(?=\s+(?:Ref:|MÃ¡s info|DESCRIPCIÃ“N|CARACTERISTICAS|CONTENIDO|$))/i)?.[1];
    variants.push({title,supplierSku:mainSku,manufacturerReference:mainManufacturerRef,stockText:stockText?clean(stockText):undefined,price:salePrice,productUrl});
  }
  if(!variants.length&&!salePrice)return undefined;
  return {title,manufacturer:manufacturer||undefined,vatRate,regularPrice,salePrice,variants,productUrl,promotionText};
}

export function parseDentalCostProductHtml(html:string,productUrl:string):DentalCostProductRaw{
  const $=cheerio.load(html);
  const body=clean($("body").text());
  const title=clean($("h1").first().text()) || "Producto DentalCost";
  const manufacturer=clean($(".manufacturer-name,.product-manufacturer,[itemprop=brand]").first().text()) || body.match(/(?:^|\s)(Solventum|3M ESPE|Medicaline|Starline|Cuatrogasa)(?:\s|$)/i)?.[1];
  const gross=body.match(/Precio con IVA\s*\((\d+(?:[.,]\d+)?)%\)\s*(\d+(?:[.,]\d+)?)\s*€/i);
  const net=body.match(/Precio sin IVA\s*(\d+(?:[.,]\d+)?)\s*€/i);
  const crossed=body.match(/-(\d+)%\s*(\d+(?:[.,]\d+)?)\s*€/i);
  const vatRate=gross?Number(gross[1].replace(",",".")):undefined;
  const salePrice=net?euro(net[1]):undefined;
  const regularPrice=crossed?euro(crossed[2]):salePrice;
  const promoIndex=body.search(/(?:Oferta|Promoci[oó]n|Descuento|Compra|Envío gratis)/i);
  const promotionText=promoIndex>=0?body.slice(promoIndex,promoIndex+600):undefined;

  const variants:DentalCostVariantRaw[]=[];
  const seen=new Set<string>();
  const re=/([^]{0,220}?)Ref:\s*([A-Za-z0-9._/-]+)\s*Ref\s*fabricante:\s*([A-Za-z0-9._/-]+)\s*Disponibilidad:\s*([^€]{1,80}?)\s*(\d+(?:[.,]\d+)?)\s*€/gi;
  for(const m of body.matchAll(re)){
    const ref=m[3].trim();
    if(ref==="0"||seen.has(ref)) continue;
    seen.add(ref);
    variants.push({
      title:clean(m[1]).slice(-180),
      supplierSku:m[2].trim(),
      manufacturerReference:ref,
      stockText:clean(m[4]),
      price:euro(m[5]),
      productUrl
    });
  }

  const mainSku=body.match(/(?:Referencia|Ref):\s*([A-Za-z0-9._/-]+)/i)?.[1];
  const mainManufacturerRef=body.match(/Ref\.?\s*Fabricante:\s*([A-Za-z0-9._/-]+)/i)?.[1];
  if(mainManufacturerRef && mainManufacturerRef!=="0" && !seen.has(mainManufacturerRef) && salePrice){
    const stockText=body.match(/Disponibilidad:\s*((?:\d+\s*(?:uds?|art(?:ículo)?s?)\s*(?:disponible)?|Fuera de stock|Sin stock|Agotado))/i)?.[1] ?? body.match(/Disponibilidad:\s*([^€]{1,120}?)(?=\s+(?:Ref:|Más info|DESCRIPCIÓN|CARACTERISTICAS|CONTENIDO|$))/i)?.[1];
    variants.push({
      title,
      supplierSku:mainSku,
      manufacturerReference:mainManufacturerRef,
      stockText:stockText?clean(stockText):undefined,
      price:salePrice,
      productUrl
    });
  }
  return {title,manufacturer:manufacturer||undefined,vatRate,regularPrice,salePrice,variants,productUrl,promotionText};
}
