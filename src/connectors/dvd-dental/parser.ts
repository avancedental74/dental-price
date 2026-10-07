import * as cheerio from "cheerio";
import type { DvdProductRaw, DvdVariantRaw } from "./types";
function euro(v?:string):number|undefined{if(!v)return;const n=Number(v.replace(/\s/g,"").replace(/€/g,"").replace(/\./g,"").replace(",",".").replace(/[^0-9.]/g,""));return Number.isFinite(n)?n:undefined;}
const clean=(v:string)=>v.replace(/\s+/g," ").trim();
function labeledValue($:cheerio.CheerioAPI,label:RegExp):string|undefined{
  let found:string|undefined;
  $("p,div,dd,span").each((_,el)=>{
    if(found) return;
    const text=clean($(el).clone().children().remove().end().text()) || clean($(el).text());
    const match=text.match(label);
    if(match?.[1]) found=match[1].trim();
  });
  return found;
}

export function parseDvdProductHtml(html:string,productUrl:string):DvdProductRaw{
 const $=cheerio.load(html), body=clean($("body").text());
 const title=clean($("h1").first().text())||"Producto DVD Dental";
 const manufacturer=clean($(".manufacturer-name,.product-manufacturer,[itemprop=brand]").first().text())
   || body.match(/\b(SOLVENTUM|3M ESPE|DENTSPLY SIRONA|IVOCLAR|KERR|KULZER|GC|VOCO)\b/i)?.[1]
   || undefined;
 const variants:DvdVariantRaw[]=[]; const seen=new Set<string>();
 $("table tr").each((_,el)=>{
   const cells=$(el).find("td").map((__,c)=>clean($(c).text())).get();
   if(cells.length<3) return;
   const joined=cells.join(" | ");
   const refFab=cells.find(x=>/^4910[A-Z0-9.]+$/i.test(x) || /^4911[A-Z0-9.]+$/i.test(x));
   if(!refFab||seen.has(refFab)) return;
   seen.add(refFab);
   const prices=cells.flatMap(x=>[...x.matchAll(/(\d+(?:[.,]\d+)?)\s*€/g)].map(m=>euro(m[1]))).filter((x):x is number=>typeof x==="number");
   variants.push({title:joined,supplierSku:cells[1],manufacturerReference:refFab,netPrice:prices[0],grossPrice:prices[1],stockText:joined,productUrl});
 });
 if(!variants.length){
   const ref=labeledValue($,/REF\.\s*FAB\s*:\s*([A-Za-z0-9._/-]+)/i) ?? body.match(/REF\.\s*FAB\s*:\s*([A-Za-z0-9._/-]+?)(?=\s|$)/i)?.[1];
   const sku=$("[data-product-sku]").first().text().trim() || labeledValue($,/REF\.\s*DVD\s*:?[\s]*([A-Za-z0-9._/-]+)/i) ?? body.match(/REF\.\s*DVD\s*([A-Za-z0-9._/-]+?)(?=\s|$)/i)?.[1];
   const gross=body.match(/(\d+(?:[.,]\d+)?)\s*€\s*IVA incl/i)?.[1];
   const net=body.match(/(\d+(?:[.,]\d+)?)\s*€\s*excl\.\s*Tax/i)?.[1];
   const localStock=clean($(".productView__stock,.form-field--stock").first().text())
     || body.match(/\b\d+\s+en stock\b|Disponible para compra|Sin stock|No disponible|Agotado/i)?.[0];
   if(ref) variants.push({title,supplierSku:sku,manufacturerReference:ref,netPrice:euro(net),grossPrice:euro(gross),stockText:localStock||undefined,productUrl});
 }
 const promotionText=clean($(".promo-sku-tooltip-item").first().text()) || labeledValue($,/(Compra\s+\d+[^.]{0,220}(?:regalamos|gratis)[^.]{0,220})/i) || undefined;
 return {title,manufacturer,variants,productUrl,promotionText};
}
