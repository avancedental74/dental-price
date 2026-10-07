import type { Promotion } from "../../types/domain";

export function extractPromotionFromText(text:string):Promotion|undefined{
  const normalized=text.replace(/\s+/g," ").trim();
  const buyGet=normalized.match(/\b(?:compra\s*)?(\d+)\s*\+\s*(\d+)\b/i);
  if(buyGet) return {type:"buy_x_get_y",description:buyGet[0],minQty:Number(buyGet[1]),freeQty:Number(buyGet[2])};
  const pct=normalized.match(/(?:-|descuento\s*(?:del)?\s*)(\d{1,2})\s*%/i);
  if(pct){const value=Number(pct[1]);if(value>0&&value<=100)return {type:"percentage_discount",description:pct[0],discountPercent:value};}
  if(/env[ií]o\s+gratis|portes\s+gratis/i.test(normalized)) return {type:"free_shipping",description:"Envío gratis"};
  return undefined;
}

export function promotionForObservedPrices(text:string,regularPrice?:number,salePrice?:number):Promotion|undefined{
  const promotion=extractPromotionFromText(text);
  if(!promotion) return undefined;
  if(promotion.type==="percentage_discount" && typeof salePrice==="number" && typeof regularPrice==="number" && salePrice<regularPrice){
    return undefined;
  }
  return promotion;
}