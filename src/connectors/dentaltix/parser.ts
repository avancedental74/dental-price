import * as cheerio from "cheerio";
import type { DentaltixProductRaw, DentaltixVariantRaw } from "./types";

function parseEuro(value?: string): number | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s/g, "").replace(/€/g, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}

function extractLabeledValue(bodyText: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped + "\\s*:?\\s*([A-Za-z0-9._/-]+)", "i");
    const match = bodyText.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function stockFromText(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (/solo quedan|en stock|entrega|disponible|no disponible|agotado/i.test(normalized)) return normalized;
  return undefined;
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
  return variants;
}

export function parseDentaltixProductHtml(html: string, productUrl: string): DentaltixProductRaw {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const jsonLd = parseJsonLd($);
  const productLd = jsonLd.find(item => item["@type"] === "Product");
  const brand = productLd?.brand as Record<string, unknown> | string | undefined;
  const offers = productLd?.offers as Record<string, unknown> | undefined;
  const title = $("h1").first().text().replace(/\s+/g, " ").trim() || (typeof productLd?.name === "string" ? productLd.name : "Producto Dentaltix");
  const manufacturer = $(" .product-brand, .brand, [itemprop=\"brand\"]").first().text().replace(/\s+/g, " ").trim() || (typeof brand === "string" ? brand : typeof brand?.name === "string" ? String(brand.name) : bodyText.match(/Marca\s*:?\s*([A-Za-z0-9 .&-]+)/i)?.[1]?.trim());
  const pageSupplierSku = $("[data-product-sku]").first().attr("data-product-sku") ?? $("[data-sku]").first().attr("data-sku") ?? extractLabeledValue(bodyText, ["Referencia", "Ref."]);
  const pageManufacturerReference = extractLabeledValue(bodyText, ["Ref. Fabricante", "Ref. fab.", "Manufacturer Ref.", "Manuf. ref."]);
  const allPrices = [...bodyText.matchAll(/(\d{1,4}(?:[.,]\d{2})?)\s*€/g)].map(m => parseEuro(m[1])).filter((v): v is number => typeof v === "number");
  let salePrice = typeof offers?.price === "string" || typeof offers?.price === "number" ? Number(String(offers.price).replace(",", ".")) : undefined;
  if (!Number.isFinite(salePrice)) salePrice = undefined;
  if (salePrice == null && allPrices.length) salePrice = allPrices[0];
  const recommended = bodyText.match(/Precio recomendado\s*(\d{1,4}(?:[.,]\d{2})?)\s*€/i);
  const regularPrice = recommended ? parseEuro(recommended[1]) : allPrices.length >= 2 ? Math.max(...allPrices.slice(0, 6)) : undefined;
  const vatMatch = bodyText.match(/(?:Price VAT included|Precio IVA incluido)\s*\(?\s*(\d{1,2})\s*%\s*\)?\s*€?\s*(\d{1,5}(?:[.,]\d{2})?)/i);
  const vatRate = vatMatch ? Number(vatMatch[1]) : undefined;
  const vatIncludedPrice = vatMatch ? parseEuro(vatMatch[2]) : undefined;
  const stockMatch = bodyText.match(/(Solo quedan[^.]+\.|En stock[^.]+\.|Entrega[^.]+\.|No disponible[^.]*\.?)/i)?.[1];
  return {
    title,
    manufacturer: manufacturer || undefined,
    pageSupplierSku,
    pageManufacturerReference,
    regularPrice,
    salePrice,
    vatIncludedPrice,
    vatRate,
    rawStockText: stockFromText(stockMatch),
    productUrl,
    variants: extractVariants($, productUrl)
  };
}