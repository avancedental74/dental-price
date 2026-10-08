import * as cheerio from "cheerio";
import type { SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";

const USER_AGENT="DentalPrice/0.2 (+https://github.com/avancedental74/dental-price; single-user price research)";

function productLd($:cheerio.CheerioAPI){
  for(const el of $('script[type="application/ld+json"]').toArray()){
    const raw=$(el).text().trim();
    if(!raw)continue;
    try{
      const parsed=JSON.parse(raw);
      const items=Array.isArray(parsed)?parsed:[parsed];
      for(const item of items){
        if(item&&typeof item==="object"&&item["@type"]==="Product")return item as Record<string,unknown>;
      }
    }catch{ /* ignore malformed JSON-LD */ }
  }
  return undefined;
}

function inferMetrics(text:string){
  const metric=text.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|gr)\b/i);
  const pack=text.match(/\b(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(ml|g|gr)\b/i);
  if(pack)return {quantity:Number(pack[2].replace(",",".")),unit:pack[3].toLowerCase().startsWith("g")?"g":"ml",packCount:Number(pack[1])};
  if(metric)return {quantity:Number(metric[1].replace(",",".")),unit:metric[2].toLowerCase().startsWith("g")?"g":"ml",packCount:1};
  return {};
}

export async function fetchDentipakProduct(productUrl:string,fetchImpl:typeof fetch=fetch):Promise<{offers:SupplierOffer[]}>{
  const response=await fetchImpl(productUrl,{headers:{"user-agent":USER_AGENT,accept:"text/html,application/xhtml+xml"},redirect:"follow"});
  if(!response.ok)throw new Error("Dentipak HTTP "+response.status);
  const html=await response.text(),$=cheerio.load(html);
  const body=$("body").text().replace(/\s+/g," ").trim();
  const ld=productLd($);
  if(!ld)return {offers:[]};

  const title=String(ld.name??$("h1").first().text()).replace(/\s+/g," ").trim();
  const sku=typeof ld.sku==="string"?ld.sku:undefined;
  const offerLd=ld.offers&&typeof ld.offers==="object"&&!Array.isArray(ld.offers)?ld.offers as Record<string,unknown>:undefined;
  const price=Number(offerLd?.price);
  if(!Number.isFinite(price)||price<=0)return {offers:[]};

  const explicitRef=body.match(/\bRef\.?\s*[:.]?\s*([A-Za-z0-9._/-]{3,30})\b/i)?.[1];
  const manufacturerReference=explicitRef&&explicitRef!==sku?explicitRef:undefined;
  const availability=String(offerLd?.availability??"");
  const stockStatus=/InStock/i.test(availability)?"in_stock":/OutOfStock|SoldOut/i.test(availability)?"unavailable":"unknown";
  const oldPriceText=$(".oe_default_price .oe_currency_value").first().text().trim();
  const oldPrice=oldPriceText?Number(oldPriceText.replace(/\./g,"").replace(",",".")):undefined;
  const metrics=inferMetrics(title+" "+body.slice(0,2500));
  const manufacturer=/SOLVENTUM/i.test(title)?"Solventum":/\b3M\b/i.test(title)?"3M":undefined;

  const offer:SupplierOffer={
    supplierId:"dentipak",
    supplierSku:sku,
    manufacturer,
    manufacturerReference,
    rawName:title,
    normalizedName:normalizeName([title,manufacturer??""].join(" ")),
    productUrl:response.url||productUrl,
    presentation:/frasco|bote|botella/i.test(title+" "+body.slice(0,2500))?"Frasco":/jeringa/i.test(title)?"Jeringa":undefined,
    quantity:metrics.quantity,
    unit:metrics.unit,
    packCount:metrics.packCount,
    stockStatus,
    rawStockText:stockStatus==="in_stock"?"InStock":stockStatus==="unavailable"?"OutOfStock":undefined,
    regularPrice:typeof oldPrice==="number"&&oldPrice>price?oldPrice:price,
    salePrice:price,
    vatStatus:"unknown",
    currency:"EUR",
    deliveryEstimate:/2-3 d[ií]as laborables|24\/48h/i.test(body)?"2-3 días laborables":undefined,
    observedAt:new Date().toISOString(),
    sourceStatus:"normal",
    sourceMode:"automatic"
  };
  return {offers:[offer]};
}
