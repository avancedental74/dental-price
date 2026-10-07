import { parseDentaltixProductHtml } from "../src/connectors/dentaltix/parser";
import { normalizeDentaltix } from "../src/connectors/dentaltix/normalizer";

const url="https://www.dentaltix.com/es/3m/filtek-supreme-xte-kit-composite-profesional-12-jer?sku=053M4910A3B";
const response=await fetch(url,{headers:{"user-agent":"DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)",accept:"text/html,application/xhtml+xml"}});
const html=await response.text();
const raw=parseDentaltixProductHtml(html,url);
const offers=normalizeDentaltix(raw);
console.log(JSON.stringify({
  status:response.status,length:html.length,finalUrl:response.url,
  raw:{title:raw.title,manufacturer:raw.manufacturer,pageSupplierSku:raw.pageSupplierSku,pageManufacturerReference:raw.pageManufacturerReference,regularPrice:raw.regularPrice,salePrice:raw.salePrice,vatRate:raw.vatRate,rawStockText:raw.rawStockText,variantCount:raw.variants.length,variants:raw.variants.slice(0,8)},
  offers:offers.slice(0,8)
},null,2));