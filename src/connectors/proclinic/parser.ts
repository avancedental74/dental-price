import * as cheerio from "cheerio";
import type { ProclinicProductRaw, ProclinicVariantRaw } from "./types";

function parseEuro(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned=value.replace(/\s/g,"").replace(/€/g,"").replace(/\./g,"").replace(",",".").replace(/[^0-9.]/g,"");
  const n=Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function firstText($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const v=$(selector).first().text().replace(/\s+/g," ").trim();
    if (v) return v;
  }
  return undefined;
}

function labeled(text: string, label: string): string | undefined {
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return text.match(new RegExp(escaped+"\\s*:?\\s*([A-Za-z0-9._/-]+)","i"))?.[1];
}

function extractVariants($: cheerio.CheerioAPI, url: string): ProclinicVariantRaw[] {
  const variants: ProclinicVariantRaw[]=[];
  const seen=new Set<string>();
  const selectors=[".product-options .item",".product-options .option",".product-option",".model-option",".product-options-wrapper .item","[data-product-option]"];
  $(selectors.join(",")).each((_,el)=>{
    const node=$(el);
    const txt=node.text().replace(/\s+/g," ").trim();
    if (!txt) return;
    const supplierSku=node.attr("data-sku") ?? labeled(txt,"Ref. Proclinic");
    const manufacturerReference=node.attr("data-manufacturer-reference") ?? labeled(txt,"Ref. fabricante");
    const prices=[...txt.matchAll(/(\d{1,5}(?:[.,]\d{2})?)\s*€/g)].map(m=>parseEuro(m[1])).filter((v): v is number=>typeof v==="number");
    const vat=txt.match(/Precio con IVA incluido\s*(\d{1,5}(?:[.,]\d{2})?)\s*€/i);
    const key=[supplierSku,manufacturerReference,txt.slice(0,100)].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    variants.push({
      title: txt, supplierSku, manufacturerReference,
      regularPrice: prices.length>=2 ? Math.max(...prices.slice(0,3)) : undefined,
      salePrice: prices.length ? Math.min(...prices.slice(0,3)) : undefined,
      vatIncludedPrice: vat ? parseEuro(vat[1]) : undefined,
      rawStockText: /entrega|stock|disponible|agotado/i.test(txt) ? txt : undefined,
      productUrl:url
    });
  });
  return variants;
}

export function parseProclinicProductHtml(html: string, productUrl: string): ProclinicProductRaw {
  const $=cheerio.load(html);
  const body=$("body").text().replace(/\s+/g," ").trim();
  const title=firstText($,["h1",".page-title","[itemprop=\"name\"]"]) ?? "Producto Proclinic";
  const manufacturer=body.match(/Marca\s+([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .&-]*?)(?=\s+(?:Ref\.|Contenido|Oferta|IVA|Precio web|Entrega|$))/i)?.[1]?.trim();
  const contentText=body.match(/Contenido\s+(.+?)(?=\s+Ref\. fabricante|\s+IVA no inclu|\s+Oferta|\s+Precio web)/i)?.[1]?.trim();
  const pageSupplierSku=labeled(body,"Ref. Proclinic");
  const pageManufacturerReference=labeled(body,"Ref. fabricante");
  const webBlock=body.match(/Precio web\s+(?:¡Mejor oferta![^0-9€]*)?([\s\S]{0,120}?)(?=Precio con IVA incluido|Entrega|$)/i)?.[1] ?? "";
  const prices=[...webBlock.matchAll(/(\d{1,5}(?:[.,]\d{2})?)\s*€/g)].map(m=>parseEuro(m[1])).filter((v): v is number=>typeof v==="number");
  const allPrices=[...body.matchAll(/(\d{1,5}(?:[.,]\d{2})?)\s*€/g)].map(m=>parseEuro(m[1])).filter((v): v is number=>typeof v==="number");
  const vatMatch=body.match(/Precio con IVA incluido\s*(\d{1,5}(?:[.,]\d{2})?)\s*€/i);
  const salePrice=prices.length ? Math.min(...prices) : allPrices.length ? allPrices[0] : undefined;
  const regularPrice=prices.length>=2 ? Math.max(...prices) : undefined;
  const freeShipping=body.match(/Envíos?\s+(?:GRATIS|gratuitos?)\s+(?:a partir de|desde)\s*(\d+(?:[.,]\d{2})?)\s*€/i);
  const stock=body.match(/(Entrega en\s+\d+\s*h|En stock|No disponible|Agotado)/i)?.[1];
  return {
    title, manufacturer, contentText, pageSupplierSku, pageManufacturerReference,
    regularPrice, salePrice, vatIncludedPrice:vatMatch ? parseEuro(vatMatch[1]) : undefined,
    rawStockText:stock, freeShippingThreshold:freeShipping ? parseEuro(freeShipping[1]) : undefined,
    productUrl, variants:extractVariants($,productUrl)
  };
}