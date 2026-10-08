import * as cheerio from "cheerio";
import type { SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";

const USER_AGENT="DentalPrice/0.2 (+https://github.com/avancedental74/dental-price; single-user price research)";

function findProductLd($:cheerio.CheerioAPI){
  const visit=(value:unknown):Record<string,unknown>|undefined=>{
    if(!value||typeof value!=="object")return undefined;
    if(Array.isArray(value)){
      for(const item of value){const found=visit(item);if(found)return found;}
      return undefined;
    }
    const obj=value as Record<string,unknown>;
    if(obj["@type"]==="Product")return obj;
    if(Array.isArray(obj["@graph"])){
      for(const item of obj["@graph"] as unknown[]){const found=visit(item);if(found)return found;}
    }
    return undefined;
  };
  for(const el of $('script[type="application/ld+json"]').toArray()){
    try{
      const found=visit(JSON.parse($(el).text()));
      if(found)return found;
    }catch{ /* ignore malformed JSON-LD */ }
  }
  return undefined;
}

function metrics(text:string){
  const pack=text.match(/\b(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(ml|g|gr)\b/i);
  if(pack)return {quantity:Number(pack[2].replace(",",".")),unit:pack[3].toLowerCase().startsWith("g")?"g":"ml",packCount:Number(pack[1])};
  const m=text.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|gr)\b/i);
  return m?{quantity:Number(m[1].replace(",",".")),unit:m[2].toLowerCase().startsWith("g")?"g":"ml",packCount:1}:{};
}

export async function fetchDentalBoomProduct(productUrl:string,fetchImpl:typeof fetch=fetch):Promise<{offers:SupplierOffer[]}>{
  const response=await fetchImpl(productUrl,{headers:{"user-agent":USER_AGENT,accept:"text/html,application/xhtml+xml"},redirect:"follow"});
  if(!response.ok)throw new Error("Dental Boom HTTP "+response.status);
  const html=await response.text(),$=cheerio.load(html);
  const body=$("body").text().replace(/\s+/g," ").trim();
  const ld=findProductLd($);
  if(!ld)return {offers:[]};
  const title=String(ld.name??$("h1").first().text()).replace(/\s+/g," ").replace(/\s*\|\s*Dental Boom\s*$/i,"").trim();
  const offerLd=ld.offers&&typeof ld.offers==="object"&&!Array.isArray(ld.offers)?ld.offers as Record<string,unknown>:undefined;
  const price=Number(offerLd?.price);
  if(!Number.isFinite(price)||price<=0)return {offers:[]};
  const regularText=$("del .woocommerce-Price-amount").first().text().replace(/\s+/g," ").trim();
  const regularParsed=regularText?Number(regularText.replace(/[^0-9,.-]/g,"").replace(/\./g,"").replace(",",".")):undefined;
  const vat=body.match(/con\s+IVA\s*\((\d+(?:[.,]\d+)?)%\)/i)?.[1];
  const vatRate=vat?Number(vat.replace(",",".")):undefined;
  const availability=String(offerLd?.availability??"");
  const stockStatus=/InStock/i.test(availability)?"in_stock":/OutOfStock|SoldOut/i.test(availability)?"unavailable":"unknown";
  const brandObj=ld.brand&&typeof ld.brand==="object"&&!Array.isArray(ld.brand)?ld.brand as Record<string,unknown>:undefined;
  const manufacturer=typeof brandObj?.name==="string"?brandObj.name:undefined;
  const sku=typeof ld.sku==="string"?ld.sku:undefined;
  const q=metrics(title+" "+String(ld.description??""));
  const offer:SupplierOffer={
    supplierId:"dentalboom",
    supplierSku:sku,
    manufacturer,
    rawName:title,
    normalizedName:normalizeName([title,manufacturer??""].join(" ")),
    productUrl:response.url||productUrl,
    presentation:/frasco/i.test(title+" "+String(ld.description??""))?"Frasco":/jeringa/i.test(title)?"Jeringa":undefined,
    quantity:q.quantity,unit:q.unit,packCount:q.packCount,
    stockStatus,
    rawStockText:stockStatus==="in_stock"?"InStock":stockStatus==="unavailable"?"OutOfStock":undefined,
    regularPrice:typeof regularParsed==="number"&&regularParsed>price?regularParsed:price,
    salePrice:price,
    vatStatus:typeof vatRate==="number"?"excluded":"unknown",
    vatRate,
    currency:"EUR",
    observedAt:new Date().toISOString(),
    sourceStatus:"normal",
    sourceMode:"automatic"
  };
  return {offers:[offer]};
}
