import * as cheerio from "cheerio";
import type { DentalCostProductRaw, DentalCostVariantRaw } from "./types";

function euro(value?:string):number|undefined{
  if(!value) return undefined;
  const n=Number(value.replace(/\s/g,"").replace(/€/g,"").replace(/\./g,"").replace(",",".").replace(/[^0-9.]/g,""));
  return Number.isFinite(n)?n:undefined;
}
function clean(value:string):string{return value.replace(/\s+/g," ").trim();}

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
  const promotionText=body.match(/(?:Oferta|Promoci[oó]n|Descuento|Compra|Envío gratis)[^.]{0,160}(?:\.|$)/i)?.[0]
    ?? body.match(/\b\d+\s*\+\s*\d+\b[^.]{0,120}/i)?.[0]
    ?? body.match(/-\d{1,2}\s*%[^.]{0,120}/i)?.[0];

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
