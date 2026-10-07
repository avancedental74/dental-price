import * as cheerio from "cheerio";
import type { StockStatus, SupplierOffer } from "../../types/domain";
import { normalizeName } from "../../domain/matching/normalization";
import { knowledgeForReference } from "../../domain/catalog";
const USER_AGENT="DentalPrice/0.2 (+https://github.com/avancedental74/dental-price; single-user price research)";
function euro(v?:string){if(!v)return undefined;let s=v.replace(/\s/g,"").replace(/€/g,"").replace(/[^0-9,.-]/g,"");if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");const n=Number(s);return Number.isFinite(n)?n:undefined;}
function stock(text:string):StockStatus{if(/agotado|no disponible|sin stock/i.test(text))return"unavailable";if(/24\/48|disponib|cantidad|sum\./i.test(text))return"in_stock";return"unknown";}
function metrics(text:string){const pack=text.match(/(\d+)\s*(?:cavifills?|uds?\.?|unidades)/i);const m=text.match(/(\d+(?:[.,]\d+)?)\s*(g|grm?|ml)\b/i);return{packCount:pack?Number(pack[1]):undefined,quantity:m?Number(m[1].replace(",",".")):undefined,unit:m?(m[2].toLowerCase().startsWith("g")?"g":"ml"):undefined};}
export async function fetchOrtolanProduct(productUrl:string,fetchImpl:typeof fetch=fetch):Promise<{offers:SupplierOffer[]}>{
 const response=await fetchImpl(productUrl,{headers:{"user-agent":USER_AGENT,accept:"text/html,application/xhtml+xml"}});
 if(!response.ok)throw new Error("Ortolan HTTP "+response.status);
 const html=await response.text(),$=cheerio.load(html),body=$("body").text().replace(/\s+/g," ").trim();
 const title=$("h1").first().text().replace(/\s+/g," ").trim()||"Producto Ortolan";
 const brand=$(".product-manufacturer,.manufacturer-name").first().text().replace(/\s+/g," ").trim()||undefined;
 const rows:string[]=[];
 $("table tr").each((_,el)=>{const t=$(el).text().replace(/\s+/g," ").trim();if(/€/.test(t))rows.push(t);});
 if(!rows.length)rows.push(body);
 const offers:SupplierOffer[]=[];
 for(const text of rows){
   const ref=text.match(/^([A-Za-z0-9.,_-]{3,40})\s+/)?.[1]||body.match(/COD:\s*([A-Za-z0-9.,_-]+)/i)?.[1];
   const mfg=text.match(/Ref\. fabricante\s*:?\s*([A-Za-z0-9._/-]+)/i)?.[1];
   const manufacturerReference=mfg;
   const prices=[...text.matchAll(/(\d{1,5}(?:[.,]\d{2})?)\s*€/g)].map(m=>euro(m[1])).filter((v):v is number=>typeof v==="number"&&v>0);
   if(!prices.length)continue;
   const regularPrice=prices.length>1?Math.max(...prices.slice(0,3)):prices[0],salePrice=Math.min(...prices.slice(0,3));
   const known=knowledgeForReference(manufacturerReference),mx=metrics(text);
   const shade=text.match(/\b(A\d(?:[.,]5)?|B\d(?:[.,]5)?|C\d(?:[.,]5)?|D\d(?:[.,]5)?)\b/i)?.[1]?.replace(",",".").toUpperCase();
   offers.push({supplierId:"ortolan",supplierSku:ref,manufacturer:brand,manufacturerReference,rawName:text.slice(0,240),normalizedName:normalizeName([title,text,brand??""].join(" ")),productUrl,
    presentation:known.presentation??(/jeringa/i.test(text)?"Jeringa":/cavifill|capsul|cápsul/i.test(text)?"Cápsulas":undefined),quantity:known.quantity??mx.quantity,unit:known.unit??mx.unit,packCount:known.packCount??mx.packCount,variant:known.variant,shade:known.shade??shade,
    stockStatus:stock(text+" "+body.slice(0,1000)),regularPrice,salePrice,vatStatus:"excluded",currency:"EUR",deliveryEstimate:"24/48 h Península",observedAt:new Date().toISOString(),sourceStatus:"normal",sourceMode:"automatic"});
 }
 return {offers};
}

export async function healthCheckOrtolan(url="https://ortolan.es/es/odontologia/3802-tetric-evoceram.html",fetchImpl:typeof fetch=fetch){
  const checkedAt=new Date().toISOString();
  try{
    const result=await fetchOrtolanProduct(url,fetchImpl);
    if(!result.offers.length) return {status:"amber" as const,checkedAt,message:"Página accesible pero parser sin ofertas"};
    return {status:"green" as const,checkedAt,message:result.offers.length+" oferta(s) normalizada(s)"};
  }catch(error){return {status:"red" as const,checkedAt,message:error instanceof Error?error.message:"Ortolan error desconocido"};}
}
