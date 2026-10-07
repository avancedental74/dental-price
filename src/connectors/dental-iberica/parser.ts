import * as cheerio from "cheerio";
import type { DentalIbericaProductRaw, DentalIbericaVariantRaw } from "./types";

function parseEuro(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned=value.replace(/\s/g,"").replace(/€/g,"").replace(/\./g,"").replace(",",".").replace(/[^0-9.]/g,"");
  const n=Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function clean(value?: string): string | undefined {
  const v=value?.replace(/\s+/g," ").trim();
  return v || undefined;
}

function extractVariants($: cheerio.CheerioAPI, productUrl: string): DentalIbericaVariantRaw[] {
  const variants: DentalIbericaVariantRaw[]=[];
  const seen=new Set<string>();
  const selectors=[".product-combination",".product-variant",".combination-item",".product-model",".product-variants .item",".product-reference-row","article.product-miniature","tr"];
  $(selectors.join(",")).each((_,el)=>{
    const node=$(el);
    const txt=clean(node.text());
    if(!txt || !/Ref\.|Ref\. Fabricante|€/i.test(txt)) return;
    const supplierSku=node.attr("data-reference") ?? txt.match(/\bRef\.\s+([A-Za-z0-9._/-]+)(?=\s+Ref\. Fabricante|\s|$)/i)?.[1];
    const manufacturerReference=node.attr("data-manufacturer-reference") ?? txt.match(/Ref\. Fabricante\s+([A-Za-z0-9._/-]+)/i)?.[1];
    const priceMatch=txt.match(/(\d{1,5}(?:[.,]\d{2})?)\s*€/);
    const rawStockText=txt.match(/(En stock|Sin stock(?: temporalmente)?(?:\. Compra disponible\. Envío en unos días)?)/i)?.[1];
    if(!supplierSku && !manufacturerReference) return;
    const title=clean(txt.replace(/\bRef\.\s+[A-Za-z0-9._/-]+/i,"").replace(/Ref\. Fabricante\s+[A-Za-z0-9._/-]+/i,"").replace(/\b(?:En stock|Sin stock[^€]*)/i,"").replace(/\d{1,5}(?:[.,]\d{2})?\s*€/,"")) ?? txt;
    const key=[supplierSku,manufacturerReference,title].join("|");
    if(seen.has(key)) return;
    seen.add(key);
    variants.push({title,supplierSku,manufacturerReference,price:priceMatch?parseEuro(priceMatch[1]):undefined,rawStockText,productUrl});
  });
  if(variants.length) return variants;

  // Text fallback for pages where variants are rendered without stable wrappers.
  const body=clean($("body").text()) ?? "";
  const regex=/([A-ZÁÉÍÓÚÑ0-9][^€]{3,180}?)\s+Ref\.\s+([A-Za-z0-9._/-]+)\s+Ref\. Fabricante\s+([A-Za-z0-9._/-]+)\s+(En stock|Sin stock(?: temporalmente)?(?:\. Compra disponible\. Envío en unos días)?)\s+(\d{1,5}(?:[.,]\d{2})?)\s*€/gi;
  for(const match of body.matchAll(regex)){
    const key=[match[2],match[3],match[1]].join("|");
    if(seen.has(key)) continue;
    seen.add(key);
    variants.push({title:clean(match[1]) ?? match[1],supplierSku:match[2],manufacturerReference:match[3],rawStockText:match[4],price:parseEuro(match[5]),productUrl});
  }
  return variants;
}

export function parseDentalIbericaProductHtml(html:string,productUrl:string):DentalIbericaProductRaw{
  const $=cheerio.load(html);
  const body=clean($("body").text()) ?? "";
  const title=clean($("h1").first().text()) ?? "Producto Dental Ibérica";
  const manufacturer=body.match(/Marca:\s*([^\n]+?)(?=\s+Contenido:|\s+Referencia:|\s+Ref\. fabricante:|\s+Precio Dental Ibérica)/i)?.[1]?.trim();
  const contentText=body.match(/Contenido:\s*(.+?)(?=\s+Referencia:|\s+Ref\. fabricante:|\s+Precio Dental Ibérica)/i)?.[1]?.trim();
  const pageManufacturerReference=body.match(/Ref\. fabricante:\s*([A-Za-z0-9._/-]+)/i)?.[1];
  const rawStockText=body.match(/(En stock|Sin stock temporalmente\. Compra disponible\. Envío en unos días|Sin stock)/i)?.[1];
  return {title,manufacturer,contentText,pageManufacturerReference,rawStockText,productUrl,variants:extractVariants($,productUrl)};
}