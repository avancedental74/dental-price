import * as cheerio from "cheerio";
import type { DentaltixProductRaw, DentaltixVariantRaw } from "./types";

function parseEuro(value?: string): number | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s/g, "").replace(/€/g, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeForMatch(value:string):string{
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

function stockFromText(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (/solo quedan|en stock|entrega|disponible|no disponible|agotado/i.test(normalized)) return normalized;
  return undefined;
}

function nuxtVariants($: cheerio.CheerioAPI, productUrl: string): DentaltixVariantRaw[] {
  const output:DentaltixVariantRaw[]=[];
  const seen=new Set<string>();
  const scripts=$('script[type="application/json"],script#__NUXT_DATA__').toArray();
  const productPath=(()=>{try{return new URL(productUrl).pathname.toLowerCase();}catch{return productUrl.toLowerCase();}})();

  for(const el of scripts){
    const text=$(el).text().trim();
    if(!text.startsWith("[")) continue;
    try{
      const payload=JSON.parse(text) as unknown[];
      const resolve=(value:unknown):unknown=>{
        if(typeof value==="number"&&Number.isInteger(value)&&value>=0&&value<payload.length) return payload[value];
        return value;
      };
      const resolveObject=(value:unknown):Record<string,unknown>|undefined=>{
        const resolved=resolve(value);
        return resolved&&typeof resolved==="object"&&!Array.isArray(resolved)?resolved as Record<string,unknown>:undefined;
      };
      const roots=payload.filter((entry):entry is Record<string,unknown>=>{
        if(!entry||typeof entry!=="object"||Array.isArray(entry))return false;
        const obj=entry as Record<string,unknown>;
        return "mainVar" in obj&&"variations" in obj&&"slug" in obj;
      });
      const pageTitle=normalizeForMatch($("h1").first().text());
      const productPathTokens=new Set(productPath.split(/[^a-z0-9]+/).filter(t=>t.length>=3));
      const scoredRoots=roots.map(obj=>{
        const name=resolve(obj.name);
        if(typeof name!=="string")return {obj,score:0,matches:0};
        const normalizedName=normalizeForMatch(name);
        if(pageTitle&&(pageTitle.includes(normalizedName)||normalizedName.includes(pageTitle))){
          return {obj,score:100,matches:normalizedName.split(" ").length};
        }
        const nameTokens=normalizedName.split(" ").filter(t=>t.length>=3&&!["kit","composite","profesional","universal","producto"].includes(t));
        const titleTokens=new Set(pageTitle.split(" ").filter(t=>t.length>=3));
        const matches=nameTokens.filter(t=>titleTokens.has(t)||productPathTokens.has(t)).length;
        const score=nameTokens.length?matches/nameTokens.length:0;
        return {obj,score,matches};
      }).sort((a,b)=>b.score-a.score||b.matches-a.matches);
      const root=scoredRoots[0]&&scoredRoots[0].matches>=2&&scoredRoots[0].score>=0.45?scoredRoots[0].obj:undefined;
      if(!root) continue;

      const candidates:Record<string,unknown>[]=[];
      const addCandidate=(value:unknown)=>{
        const obj=resolveObject(value);
        if(obj&&"manRef" in obj&&"sku" in obj)candidates.push(obj);
      };
      addCandidate(root.mainVar);
      const variations=resolveObject(root.variations);
      if(variations){
        for(const value of Object.values(variations)){
          const resolved=resolve(value);
          if(Array.isArray(resolved)){
            for(const nested of resolved)addCandidate(nested);
          }else addCandidate(resolved);
        }
      }

      for(const obj of candidates){
        const manufacturerReference=resolve(obj.manRef);
        const supplierSku=resolve(obj.sku);
        if(typeof manufacturerReference!=="string"||!manufacturerReference.trim())continue;
        const longName=resolve(obj.name);
        const type=resolve(obj.type);
        const title=[typeof longName==="string"?longName:undefined,typeof type==="string"?type:undefined].filter(Boolean).join(" - ");
        if(!title)continue;
        const priceResolved=resolve(obj.price);
        let salePrice:number|undefined,regularPrice:number|undefined;
        const resolveNumber=(value:unknown):number|undefined=>{
          const resolved=resolve(value);
          return typeof resolved==="number"&&Number.isFinite(resolved)?resolved:undefined;
        };
        if(priceResolved&&typeof priceResolved==="object"&&!Array.isArray(priceResolved)){
          const priceObj=priceResolved as Record<string,unknown>;
          const sales=resolve(priceObj.sales);
          const recommended=resolve(priceObj.recommended);
          if(sales&&typeof sales==="object"&&!Array.isArray(sales))salePrice=resolveNumber((sales as Record<string,unknown>).value);
          if(recommended&&typeof recommended==="object"&&!Array.isArray(recommended))regularPrice=resolveNumber((recommended as Record<string,unknown>).value);
        }
        const stockValue=resolve(obj.stock);
        const delivery=resolve(obj.deliveryEstimate);
        const rawStockText=[typeof stockValue==="string"?stockValue:undefined,typeof delivery==="string"?delivery:undefined].filter(Boolean).join(" ");
        const sku=typeof supplierSku==="string"?supplierSku:undefined;
        const key=manufacturerReference+"|"+(sku??"");
        if(seen.has(key))continue;
        seen.add(key);
        let variantUrl=productUrl;
        if(sku){
          try{const u=new URL(productUrl);u.searchParams.set("sku",sku);variantUrl=u.toString();}catch{ /* keep base URL */ }
        }
        output.push({title,supplierSku:sku,manufacturerReference,regularPrice,salePrice,rawStockText:rawStockText||undefined,productUrl:variantUrl});
      }
    }catch{
      // optional Nuxt payload
    }
  }
  return output;
}

function parseJsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  const output: Record<string, unknown>[] = [];
  $("script[type=\"application/ld+json\"]").each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      if (Array.isArray(parsed)) {
        for (const item of parsed) if (item && typeof item === "object") output.push(item);
      } else if (parsed && typeof parsed === "object") {
        const graph = (parsed as Record<string, unknown>)["@graph"];
        if (Array.isArray(graph)) {
          for (const item of graph) if (item && typeof item === "object") output.push(item as Record<string, unknown>);
        } else output.push(parsed as Record<string, unknown>);
      }
    } catch {
      // optional metadata
    }
  });
  return output;
}

function extractVariants($: cheerio.CheerioAPI, productUrl: string): DentaltixVariantRaw[] {
  const variants: DentaltixVariantRaw[] = [];
  const seen = new Set<string>();
  const selectors = ["[data-product-variation]","[data-variation-id]",".product-variation",".variation",".product-variant",".attribute-option",".product-options-wrapper tr",".product-options-wrapper li"];
  $(selectors.join(",")).each((_, el) => {
    const node = $(el);
    const rawText = node.text().replace(/\s+/g, " ").trim();
    if (!rawText || rawText.length < 3) return;
    const manufacturerReference = node.attr("data-manufacturer-reference") ?? rawText.match(/Ref\.\s*(?:fab\.|Fabricante)\s*:?\s*([A-Za-z0-9._/-]+)/i)?.[1];
    const supplierSku = node.attr("data-sku") ?? rawText.match(/(?:Ref\.|Referencia)\s*(?!fab)([A-Za-z0-9._/-]+)/i)?.[1];
    const prices = [...rawText.matchAll(/(\d{1,4}(?:[.,]\d{2})?)\s*€/g)].map(m => parseEuro(m[1])).filter((v): v is number => typeof v === "number");
    const key = [manufacturerReference, supplierSku, rawText.slice(0, 80)].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    variants.push({
      title: rawText,
      supplierSku,
      manufacturerReference,
      regularPrice: prices.length >= 2 ? prices[0] : undefined,
      salePrice: prices.length ? prices[prices.length - 1] : undefined,
      rawStockText: stockFromText(rawText),
      productUrl
    });
  });
  if (!variants.length) {
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const row = /([^€]{5,140}?)\s+Ref\.\s+([A-Za-z0-9._/-]+)\s+(?:Ref\.\s*fab\.|Manufacturer Ref\.|Manuf\. ref\.)\s+([A-Za-z0-9._/-]+)\s+(\d{1,5}(?:[.,]\d{2})?)\s*€\s*(\d{1,5}(?:[.,]\d{2})?)\s*€/gi;
    for (const match of bodyText.matchAll(row)) {
      const title = match[1].trim();
      const supplierSku = match[2];
      const manufacturerReference = match[3];
      const key = supplierSku+"|"+manufacturerReference;
      if (seen.has(key)) continue;
      seen.add(key);
      variants.push({
        title, supplierSku, manufacturerReference,
        regularPrice: parseEuro(match[4]),
        salePrice: parseEuro(match[5]),
        rawStockText: stockFromText(title),
        productUrl
      });
    }
  }
  return variants;
}

export function parseDentaltixProductHtml(html: string, productUrl: string): DentaltixProductRaw {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const jsonLd = parseJsonLd($);
  const productLd = jsonLd.find(item => item["@type"] === "Product");
  const brand = productLd?.brand as Record<string, unknown> | string | undefined;
  const title = $("h1").first().text().replace(/\s+/g, " ").trim() || (typeof productLd?.name === "string" ? productLd.name : "Producto Dentaltix");
  const manufacturer = $(" .product-brand, .brand, [itemprop=\"brand\"]").first().text().replace(/\s+/g, " ").trim() || (typeof brand === "string" ? brand : typeof brand?.name === "string" ? String(brand.name) : bodyText.match(/Marca\s*:?\s*([A-Za-z0-9 .&-]+)/i)?.[1]?.trim());
  const urlSku = (() => { try { return new URL(productUrl).searchParams.get("sku") ?? undefined; } catch { return undefined; } })();
  const labelValue = (pattern: RegExp): string | undefined => {
    let value: string | undefined;
    $("p,div").each((_, el) => {
      if (value) return;
      const node=$(el);
      const direct=node.clone().children().remove().end().text().replace(/\s+/g," ").trim();
      const full=node.text().replace(/\s+/g," ").trim();
      if (!pattern.test(direct) && !pattern.test(full)) return;
      const strong=node.find("strong").first().text().trim();
      const spans=node.find("span");
      const candidate=strong || spans.last().text().trim();
      if(candidate && !pattern.test(candidate)) value=candidate;
    });
    return value;
  };
  const pageSupplierSku = $("[data-product-sku]").first().attr("data-product-sku") ?? $("[data-sku]").first().attr("data-sku") ?? labelValue(/^Referencia\s*:/i) ?? urlSku;
  const pageManufacturerReference = labelValue(/^Ref\.\s*Fabricante\s*:/i) ?? labelValue(/^Manufacturer Ref\.\s*:/i) ?? (urlSku?.match(/^053M(.+)$/i)?.[1]);
  const allPrices = [...bodyText.matchAll(/(\d{1,4}(?:[.,]\d{2})?)\s*€/g)].map(m => parseEuro(m[1])).filter((v): v is number => typeof v === "number");
  const visiblePriceTexts: number[] = [];
  $("span").each((_,el)=>{
    const text=$(el).text().replace(/\s+/g," ").trim();
    if(/^\d{1,5}(?:[.,]\d{2})\s*€$/.test(text)){
      const value=parseEuro(text);
      if(typeof value==="number") visiblePriceTexts.push(value);
    }
  });
  const leadingPrices=visiblePriceTexts.length>=2 ? visiblePriceTexts.slice(0,2) : allPrices.slice(0,2);
  let salePrice: number | undefined = leadingPrices.length>=2 ? leadingPrices[1] : leadingPrices[0];
  if (!Number.isFinite(salePrice)) salePrice = undefined;
  const recommended = bodyText.match(/(?:Precio recomendado|Recommended price)\s*(\d{1,4}(?:[.,]\d{2})?)\s*€/i);
  const regularPrice = recommended ? parseEuro(recommended[1]) : leadingPrices.length>=2 ? Math.max(...leadingPrices) : salePrice;
  const vatMatch = bodyText.match(/(?:Price VAT included|Precio IVA incluido)\s*\(?\s*(\d{1,2})\s*%\s*\)?\s*€?\s*(\d{1,5}(?:[.,]\d{2})?)/i);
  const vatRate = vatMatch ? Number(vatMatch[1]) : undefined;
  const vatIncludedPrice = vatMatch ? parseEuro(vatMatch[2]) : undefined;
  const stockMatch = bodyText.match(/(Solo quedan[^.]+\.|En stock[^.]+\.|Entrega[^.]+\.|No disponible[^.]*\.?)/i)?.[1];
  const promoIndex=bodyText.search(/(?:Oferta|Promoci[oó]n|Descuento|Compra|Envío gratis)/i);
  const promotionText=promoIndex>=0?bodyText.slice(promoIndex,promoIndex+600):undefined;
  const structuredVariants=nuxtVariants($,productUrl);
  const parsedVariants = structuredVariants.length ? structuredVariants : extractVariants($, productUrl);
  if (pageManufacturerReference && !parsedVariants.some(v => v.manufacturerReference === pageManufacturerReference)) {
    const selectedType =
      $("[data-testid=\"variation-cards-label\"] b").first().text().replace(/\s+/g, " ").trim() ||
      bodyText.match(/(?:Type|Tipo)\s*:\s*([^€]{3,100}?)(?=\s+\d{1,4}(?:[.,]\d{2})?\s*€|\s+IN STOCK|\s+EN STOCK|\s+En stock|$)/i)?.[1]?.trim();
    if (selectedType) {
      parsedVariants.unshift({
        title: selectedType,
        supplierSku: pageSupplierSku,
        manufacturerReference: pageManufacturerReference,
        regularPrice,
        salePrice,
        rawStockText: stockFromText(stockMatch),
        productUrl
      });
    }
  }
  return {
    title,
    manufacturer: manufacturer || undefined,
    pageSupplierSku,
    pageManufacturerReference,
    regularPrice,
    salePrice,
    vatIncludedPrice,
    vatRate,
    vatIncluded: Boolean(vatMatch),
    rawStockText: stockFromText(stockMatch),
    productUrl,
    promotionText,
    variants: parsedVariants
  };
}