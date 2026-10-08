import type {SupplierOffer} from "../../types/domain";
import type {LiveSearchGroup} from "../../services/live-prices";
import {normalizeName,normalizeUnit} from "../../domain/matching/normalization";
import {compareSupplierOffers} from "../../domain/comparison";

export type GloveFacet="material"|"size"|"powder"|"sterile"|"color"|"units";
export type GloveProperties=Partial<Record<GloveFacet,string>>;
export type GloveFilters=GloveProperties;

export interface GloveAlternative {
  id:string;
  groupId:string;
  name:string;
  supplierId:string;
  productUrl:string;
  reference?:string;
  properties:GloveProperties;
  units?:number;
  publishedPrice:number;
  effectiveBoxCost?:number;
  effectiveCostPer100?:number;
  eligible:boolean;
  issues:string[];
}
export interface GloveAlternativesResult {
  ready:boolean;
  missingSelections:GloveFacet[];
  ranked:GloveAlternative[];
  unverified:GloveAlternative[];
  matchingProducts:number;
}

const REQUIRED:GloveFacet[]=["material","size","powder","sterile"];
const clean=(value:string)=>normalizeName(value).replace(/\s+/g," ").trim();
const detect=(t:string,patterns:Array<[string,RegExp]>):string|undefined=>
  patterns.find(([,re])=>re.test(t))?.[0];

export function extractGloveProperties(value:string):GloveProperties{
  const t=clean(value);
  const material=detect(t,[["Nitrilo",/\bnitrilo\b/],["Látex",/\blatex\b/],["Vinilo",/\bvinilo\b/]]);
  const powder=detect(t,[["Sin polvo",/\bsin polvo\b/],["Con polvo",/\bcon polvo\b/]]);
  const sterile=detect(t,[["No estériles",/\b(?:no esteril(?:es)?|sin esterilizar)\b/],["Estériles",/\besteril(?:es)?\b/]]);
  const color=detect(t,[["Azul",/\bazules?\b/],["Blanco",/\bblancos?\b/],["Negro",/\bnegros?\b/]]);
  const size=t.match(/\btalla\s*(?:n[º°o.]?\s*)?(xxl|xl|xs|s|m|l|\d+(?:[.,]\d+)?)\b/)?.[1]
    ??t.match(/\bn[º°o.]\s*(\d+(?:[.,]\d+)?)\b/)?.[1];
  const units=t.match(/\b(?:caja|bolsa|pack)\s*(?:de\s*)?(\d{2,4})\s*(?:uds?\.?|unidades)\b/)?.[1]
    ??t.match(/\b(\d{2,4})\s*(?:uds?\.?|unidades)\b/)?.[1];
  return {material,powder,sterile,color,size:size?.toUpperCase().replace(",", "."),units};
}

export function mergedGloveProperties(group:LiveSearchGroup,offer:SupplierOffer):{
  properties:GloveProperties;conflicts:string[];
}{
  const groupProperties=extractGloveProperties(group.label);
  const offerProperties=extractGloveProperties(offer.rawName);
  const properties:GloveProperties={};
  const conflicts:string[]=[];
  for(const facet of ["material","size","powder","sterile","color","units"] as const){
    const source=offerProperties[facet],listed=groupProperties[facet];
    if(source&&listed&&source!==listed){
      conflicts.push("Datos contradictorios: "+facet);
    }else properties[facet]=source??listed;
  }
  // A verified per-pack quantity is valid when a name omits the unit count.
  // Do not multiply an unknown pack configuration or guess pairs as pieces.
  const count=Number(properties.units);
  if(!properties.units&&normalizeUnit(offer.unit)==="unit"&&
     typeof offer.quantity==="number"&&Number.isInteger(offer.quantity)&&
     offer.quantity>=2&&offer.quantity<=5000&&
     (!offer.packCount||offer.packCount===1)){
    properties.units=String(offer.quantity);
  }else if(properties.units&&(!Number.isInteger(count)||count<=0)){
    conflicts.push("Cantidad por envase inválida");
  }
  if(properties.units&&normalizeUnit(offer.unit)==="unit"&&offer.quantity&&offer.quantity>1&&
    (!offer.packCount||offer.packCount===1)&&Number(properties.units)!==offer.quantity){
    conflicts.push("Cantidad del título incompatible con la oferta");
  }
  return {properties,conflicts};
}

const validUrl=(value:string)=>{try{
  const url=new URL(value);
  return url.protocol==="https:"?url.toString():undefined;
}catch{return undefined;}};

export function compareGloveAlternatives(
  groups:LiveSearchGroup[],
  filters:GloveFilters,
  sessionId:string|null
):GloveAlternativesResult{
  const missingSelections=REQUIRED.filter(f=>!filters[f]);
  const ready=missingSelections.length===0;
  const ranked:GloveAlternative[]=[];
  const unverified:GloveAlternative[]=[];
  const seen=new Set<string>();
  let matchingProducts=0;
  for(const group of groups){
    if(!/\bguantes?\b/.test(clean(group.label)))continue;
    const filteredOffers=group.offers.map(offer=>({offer,...mergedGloveProperties(group,offer)}))
      .filter(item=>REQUIRED.every(f=>!filters[f]||item.properties[f]===filters[f])&&
        (!filters.color||item.properties.color===filters.color)&&
        (!filters.units||item.properties.units===filters.units));
    if(!filteredOffers.length)continue;
    matchingProducts++;
    const scored=compareSupplierOffers(group.product,group.offers,1,{
      requiredLiveSessionId:sessionId??"__MISSING_SESSION__"
    }).matches;
    for(const item of filteredOffers){
      const offer=item.offer;
      const key=offer.supplierId+"|"+(offer.supplierSku??offer.productUrl);
      if(seen.has(key))continue;
      seen.add(key);
      const matched=scored.find(m=>m.offer===offer);
      const count=Number(item.properties.units);
      const units=Number.isInteger(count)&&count>0?count:undefined;
      const issues=[...item.conflicts];
      if(!ready)issues.push("Completa los filtros imprescindibles");
      if(!units)issues.push("Unidades del envase sin confirmar");
      if(!validUrl(offer.productUrl))issues.push("Enlace del proveedor no válido");
      if(!matched?.eligibleForRanking)issues.push("Precio, identidad, stock o transporte no verificables");
      const eligible=issues.length===0&&!!matched?.pricing;
      const effectiveBoxCost=eligible?matched!.pricing!.effectiveTotalCost:undefined;
      const effectiveCostPer100=effectiveBoxCost!==undefined&&units
        ?Math.round(effectiveBoxCost/units*100*100)/100:undefined;
      const row:GloveAlternative={
        id:key,groupId:group.id,name:offer.rawName,supplierId:offer.supplierId,
        productUrl:offer.productUrl,reference:offer.manufacturerReference??offer.supplierSku,
        properties:item.properties,units,
        publishedPrice:offer.salePrice??offer.regularPrice,
        effectiveBoxCost,effectiveCostPer100,
        eligible,issues
      };
      (eligible?ranked:unverified).push(row);
    }
  }
  ranked.sort((a,b)=>(a.effectiveCostPer100??Infinity)-(b.effectiveCostPer100??Infinity));
  return {ready,missingSelections,ranked,unverified,matchingProducts};
}
