import type { Promotion } from "../../types/domain";

const STOP=new Set(["composite","universal","adhesivo","cemento","reposicion","restaurador","solventum","3m","dental","producto","filtek"]);
function tokens(value:string):string[]{return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(t=>t.length>=3&&!STOP.has(t));}

export function promotionTextMatchesProduct(promotionText:string,productTitle:string):boolean{
  const p=new Set(tokens(promotionText));
  const title=tokens(productTitle);
  if(!title.length) return false;
  const hits=title.filter(t=>p.has(t));
  if(title[0] && p.has(title[0])) return true;
  return hits.length>=Math.min(2,title.length);
}

export function extractPromotionFromText(text:string):Promotion|undefined{
  const normalized=text.replace(/\s+/g," ").trim();
  const buyGet=normalized.match(/\b(?:compra(?:ndo)?\s*)?(\d+)\s*\+\s*(\d+)\b/i);
  if(buyGet) return {type:"buy_x_get_y",description:buyGet[0],minQty:Number(buyGet[1]),freeQty:Number(buyGet[2])};
  const pct=normalized.match(/(?:-|descuento\s*(?:del)?\s*)(\d{1,2})\s*%/i);
  if(pct){const value=Number(pct[1]);if(value>0&&value<=100)return {type:"percentage_discount",description:pct[0],discountPercent:value};}
  if(/env[ií]o\s+gratis|portes\s+gratis/i.test(normalized)) return {type:"free_shipping",description:"Envío gratis"};
  return undefined;
}

export function promotionForObservedPrices(text:string,regularPrice?:number,salePrice?:number,productTitle?:string):Promotion|undefined{
  if(productTitle && text && !promotionTextMatchesProduct(text,productTitle)) return undefined;
  const promotion=extractPromotionFromText(text);
  if(!promotion) return undefined;
  if(promotion.type==="percentage_discount" && typeof salePrice==="number" && typeof regularPrice==="number" && salePrice<regularPrice) return undefined;
  return promotion;
}