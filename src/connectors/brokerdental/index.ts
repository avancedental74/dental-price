import * as cheerio from "cheerio";
import type { StockStatus, SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";
import { knowledgeForReference } from "../../domain/catalog";
const USER_AGENT="DentalPrice/0.2 (+https://github.com/avancedental74/dental-price; single-user price research)";
function euro(v?:string){if(!v)return undefined;let s=v.replace(/\s/g,"").replace(/€/g,"").replace(/[^0-9,.-]/g,"");if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");const n=Number(s);return Number.isFinite(n)?n:undefined;}
function stock(text:string):StockStatus{if(/agotado|no disponible|sin stock/i.test(text))return"unavailable";if(/stock|entrega express|24h|disponible/i.test(text))return"in_stock";return"unknown";}
function vatRateFrom(net?:number,gross?:number):number|undefined{if(!net||!gross||gross<net)return undefined;const raw=((gross/net)-1)*100;const allowed=[4,10,21];const nearest=allowed.reduce((a,b)=>Math.abs(b-raw)<Math.abs(a-raw)?b:a);return Math.abs(nearest-raw)<=0.4?nearest:undefined;}
export async function fetchBrokerDentalProduct(productUrl:string,fetchImpl:typeof fetch=fetch):Promise<{offers:SupplierOffer[]}>{
 const response=await fetchImpl(productUrl,{headers:{"user-agent":USER_AGENT,accept:"text/html,application/xhtml+xml"}});
 if(!response.ok)throw new Error("Broker Dental HTTP "+response.status);
 const html=await response.text(),$=cheerio.load(html),body=$("body").text().replace(/\s+/g," ").trim();
 const title=$("h1").first().text().replace(/\s+/g," ").trim()||"Producto Broker Dental";
 const brand=body.match(/Marca\s*:?\s*([A-Za-z0-9ÁÉÍÓÚÑ .&-]+?)(?=\s+(?:Precio|Seleccionar|Ref\.|$))/i)?.[1]?.trim();
 const blocks:string[]=[];
 $("tr,.product-item,.product-option,.item").each((_,el)=>{const t=$(el).text().replace(/\s+/g," ").trim();if(/Ref\. fabricante/i.test(t)&&/€/.test(t))blocks.push(t);});
 if(!blocks.length)blocks.push(body);
 const offers:SupplierOffer[]=[];
 for(const text of blocks){
   const manufacturerReference=text.match(/Ref\. fabricante\s*:?\s*([A-Za-z0-9._/-]+)/i)?.[1];
   const supplierSku=text.match(/(?:^|\s)Ref\s*:?\s*([0-9]{2,4}-[0-9]{3,6}|[A-Za-z0-9._/-]+)/i)?.[1];
   const prices=[...text.matchAll(/(\d{1,5}(?:[.,]\d{2})?)\s*€/g)].map(m=>euro(m[1])).filter((v):v is number=>typeof v==="number"&&v>0);
   if(!manufacturerReference||!prices.length)continue;
   const regularPrice=prices.length>1?Math.max(...prices.slice(0,3)):prices[0],salePrice=Math.min(...prices.slice(0,3));
   const known=knowledgeForReference(manufacturerReference);
   const grossMatch=text.match(/(?:Precio\s+con\s+IVA(?:\s+incluido)?|IVA\s+incluido)\s*:?\s*(\d{1,5}(?:[.,]\d{2})?)\s*€/i)
     ?? body.match(/(?:Precio\s+con\s+IVA(?:\s+incluido)?|IVA\s+incluido)\s*:?\s*(\d{1,5}(?:[.,]\d{2})?)\s*€/i);
   const vatRate=vatRateFrom(salePrice,grossMatch?euro(grossMatch[1]):undefined);
   offers.push({supplierId:"brokerdental",supplierSku,manufacturer:brand,manufacturerReference,rawName:text.slice(0,240),normalizedName:normalizeName([title,text,brand??""].join(" ")),productUrl,
    presentation:known.presentation,quantity:known.quantity,unit:known.unit,packCount:known.packCount,variant:known.variant,shade:known.shade,
    stockStatus:stock(text+" "+body.slice(0,1200)),regularPrice,salePrice,vatStatus:vatRate?"excluded":"unknown",vatRate,currency:"EUR",observedAt:new Date().toISOString(),sourceStatus:"normal",sourceMode:"automatic"});
 }
 return {offers};
}

export async function healthCheckBrokerDental(url="https://www.brokerdental.es/equia-fil-a2.html",fetchImpl:typeof fetch=fetch){
  const checkedAt=new Date().toISOString();
  try{
    const result=await fetchBrokerDentalProduct(url,fetchImpl);
    if(!result.offers.length) return {status:"amber" as const,checkedAt,message:"Página accesible pero parser sin ofertas"};
    return {status:"green" as const,checkedAt,message:result.offers.length+" oferta(s) normalizada(s)"};
  }catch(error){return {status:"red" as const,checkedAt,message:error instanceof Error?error.message:"Broker Dental error desconocido"};}
}
