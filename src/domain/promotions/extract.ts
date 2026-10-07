import type { Promotion } from "../../types/domain";

const STOP=new Set(["composite","universal","adhesivo","cemento","reposicion","restaurador","solventum","3m","dental","producto","filtek"]);
function tokens(value:string):string[]{return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(t=>t.length>=3&&!STOP.has(t));}

export function promotionTextMatchesProduct(promotionText:string,productTitle:string):boolean{
  const localBlock=promotionText.slice(0,220);
  const p=new Set(tokens(localBlock));
  const title=tokens(productTitle);
  if(!title.length) return false;
  const hits=title.filter(t=>p.has(t));
  return hits.length>=Math.min(2,title.length);
}

function validityFromText(text:string):string|undefined{
  const numeric=text.match(/(?:v[aá]lid[ao]\s+hasta(?:\s+el)?|valid\s+until)\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i);
  if(numeric) return `${numeric[3]}-${numeric[2].padStart(2,"0")}-${numeric[1].padStart(2,"0")}`;
  const months:Record<string,string>={enero:"01",febrero:"02",marzo:"03",abril:"04",mayo:"05",junio:"06",julio:"07",agosto:"08",septiembre:"09",setiembre:"09",octubre:"10",noviembre:"11",diciembre:"12"};
  const named=text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/valida\s+hasta(?:\s+el)?\s*(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i);
  if(named&&months[named[2]]) return `${named[3]}-${months[named[2]]}-${named[1].padStart(2,"0")}`;
  return undefined;
}

export function extractPromotionFromText(text:string):Promotion|undefined{
  const normalized=text.replace(/\s+/g," ").trim();
  const buyGet=normalized.match(/\b(?:compra(?:ndo)?\s*)?(\d+)\s*\+\s*(\d+)\b/i);
  if(buyGet) return {type:"buy_x_get_y",description:buyGet[0],minQty:Number(buyGet[1]),freeQty:Number(buyGet[2]),validUntil:validityFromText(normalized)};
  const pct=normalized.match(/(?:-|descuento\s*(?:del)?\s*)(\d{1,2})\s*%/i);
  if(pct){const value=Number(pct[1]);if(value>0&&value<=100)return {type:"percentage_discount",description:pct[0],discountPercent:value,validUntil:validityFromText(normalized)};}
  if(/env[ií]o\s+gratis|portes\s+gratis/i.test(normalized)) return {type:"free_shipping",description:"Envío gratis",validUntil:validityFromText(normalized)};
  return undefined;
}

export function promotionForObservedPrices(text:string,regularPrice?:number,salePrice?:number,productTitle?:string):Promotion|undefined{
  if(productTitle && text && !promotionTextMatchesProduct(text,productTitle)) return undefined;
  const promotion=extractPromotionFromText(text);
  if(!promotion) return undefined;
  if(promotion.type==="percentage_discount" && typeof salePrice==="number" && typeof regularPrice==="number" && salePrice<regularPrice) return undefined;
  return promotion;
}