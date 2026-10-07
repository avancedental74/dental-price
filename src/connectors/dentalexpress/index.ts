import * as cheerio from "cheerio";
import type { StockStatus, SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";
import { knowledgeForReference } from "../../domain/catalog";

const USER_AGENT="DentalPrice/0.2 (+https://github.com/avancedental74/dental-price; single-user price research)";
function euro(v?:string){if(!v)return undefined;const n=Number(v.replace(/\s/g,"").replace(/€/g,"").replace(/\./g,"").replace(",",".").replace(/[^0-9.]/g,""));return Number.isFinite(n)?n:undefined;}
function stock(text:string):StockStatus{if(/agotado|no disponible|sin stock/i.test(text))return"unavailable";if(/pocas unidades|últimas unidades/i.test(text))return"low_stock";if(/disponib|stock|24-48|entrega/i.test(text))return"in_stock";return"unknown";}
function vatRateFrom(net?:number,gross?:number):number|undefined{if(!net||!gross||gross<net)return undefined;const raw=((gross/net)-1)*100;const allowed=[4,10,21];const nearest=allowed.reduce((a,b)=>Math.abs(b-raw)<Math.abs(a-raw)?b:a);return Math.abs(nearest-raw)<=0.4?nearest:undefined;}
function jsonLd($:cheerio.CheerioAPI){const out:any[]=[];$('script[type="application/ld+json"]').each((_,el)=>{try{const x=JSON.parse($(el).text());if(Array.isArray(x))out.push(...x);else if(x?.["@graph"])out.push(...x["@graph"]);else out.push(x);}catch{ /* optional structured metadata */ }});return out;}
export async function fetchDentalExpressProduct(productUrl:string,fetchImpl:typeof fetch=fetch):Promise<{offers:SupplierOffer[]}>{
 const response=await fetchImpl(productUrl,{headers:{"user-agent":USER_AGENT,accept:"text/html,application/xhtml+xml"}});
 if(!response.ok)throw new Error("Dental Express HTTP "+response.status);
 const html=await response.text(),$=cheerio.load(html),body=$("body").text().replace(/\s+/g," ").trim();
 const ld=jsonLd($).find(x=>x?.["@type"]==="Product");
 const title=$("h1").first().text().replace(/\s+/g," ").trim()||ld?.name||"Producto Dental Express";
 const manufacturerReference=body.match(/Referencia del fabricante\s*:?\s*([A-Za-z0-9._/-]+?)(?=\s*(?:Referencia DE|Marca|Precio|IVA|Stock|Disponible|$))/i)?.[1]||ld?.mpn;
 const supplierSku=body.match(/Referencia DE\s*:?\s*([A-Za-z0-9._/-]+?)(?=\s*(?:Referencia del fabricante|Marca|Precio|IVA|Stock|Disponible|$))/i)?.[1]||ld?.sku;
 const brand=typeof ld?.brand==="string"?ld.brand:ld?.brand?.name;
 const offers=ld?.offers;
 const ldOffer=Array.isArray(offers)?offers[0]:offers;
 const priceFromLd=euro(String(ldOffer?.price??""));
 const visible=[...body.matchAll(/(\d{1,5}(?:[.,]\d{2})?)\s*€/g)].map(m=>euro(m[1])).filter((v):v is number=>typeof v==="number"&&v>0);
 const salePrice=priceFromLd??visible[0];
 if(!salePrice)return {offers:[]};
 const grossMatch=body.match(/(?:Precio\s+con\s+IVA\s+incluido|IVA\s+incluido)\s*:?\s*(\d{1,5}(?:[.,]\d{2})?)\s*€/i);
 const grossPrice=grossMatch?euro(grossMatch[1]):undefined;
 const vatRate=vatRateFrom(salePrice,grossPrice);
 const known=knowledgeForReference(manufacturerReference);
 const rawStock=[ldOffer?.availability,body].filter(Boolean).join(" ");
 const offer:SupplierOffer={supplierId:"dentalexpress",supplierSku,manufacturer:brand,manufacturerReference,rawName:title,normalizedName:normalizeName([title,brand??""].join(" ")),productUrl,
  presentation:known.presentation,quantity:known.quantity,unit:known.unit,packCount:known.packCount,variant:known.variant,shade:known.shade,
  stockStatus:stock(rawStock),rawStockText:String(ldOffer?.availability??""),
  regularPrice:salePrice,salePrice,vatStatus:vatRate?"excluded":"unknown",vatRate,currency:"EUR",observedAt:new Date().toISOString(),sourceStatus:"normal",sourceMode:"automatic"};
 return {offers:[offer]};
}

export async function healthCheckDentalExpress(url="https://dentalexpress.es/adhesivo-scotchbond-universal-plus-5ml-solventum-3m",fetchImpl:typeof fetch=fetch){
  const checkedAt=new Date().toISOString();
  try{
    const result=await fetchDentalExpressProduct(url,fetchImpl);
    if(!result.offers.length) return {status:"amber" as const,checkedAt,message:"Página accesible pero parser sin ofertas"};
    return {status:"green" as const,checkedAt,message:result.offers.length+" oferta(s) normalizada(s)"};
  }catch(error){return {status:"red" as const,checkedAt,message:error instanceof Error?error.message:"Dental Express error desconocido"};}
}
