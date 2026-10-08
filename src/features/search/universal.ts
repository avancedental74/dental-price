import type {SupplierOffer} from "../../types/domain";
import type {LiveSearchGroup} from "../../services/live-prices";
import {normalizeName,normalizeUnit} from "../../domain/matching/normalization";
import {compareSupplierOffers} from "../../domain/comparison";

// One pipeline for EVERY query. Category profiles add evidence, never change the workflow.
export type SearchFacet="manufacturer"|"presentation"|"shade"|"variant"|"material"|"size"|"powder"|"sterile"|"color"|"quantity";
export type SearchFilters=Partial<Record<SearchFacet,string>>;
export const facetLabels:Record<SearchFacet,string>={
  manufacturer:"Fabricante",presentation:"Presentación",shade:"Tono",variant:"Variante",
  material:"Material",size:"Talla / medida",powder:"Polvo",sterile:"Esterilidad",
  color:"Color",quantity:"Cantidad del envase"
};
export const facetOrder:SearchFacet[]=[
  "manufacturer","material","size","shade","presentation","variant","powder","sterile","color","quantity"
];
export type ProfileId="gloves"|"composite"|"burs"|"implants"|"cement"|"anesthetic"|"general";
interface Profile {id:ProfileId;label:string;signal:RegExp;required:SearchFacet[];allowCrossBrandRanking:boolean;}
const PROFILES:Profile[]=[
  {id:"gloves",label:"Guantes",signal:/\bguantes?\b/,required:["material","size","powder","sterile"],allowCrossBrandRanking:true},
  {id:"composite",label:"Composites",signal:/\b(composites?|resina compuesta|filtek|tetric)\b/,required:["shade","presentation","quantity"],allowCrossBrandRanking:false},
  {id:"burs",label:"Fresas",signal:/\b(fresas?|burs?)\b/,required:["variant","size"],allowCrossBrandRanking:false},
  {id:"implants",label:"Implantes",signal:/\b(implantes?|implant)\b/,required:["size","variant"],allowCrossBrandRanking:false},
  {id:"cement",label:"Cementos",signal:/\b(cementos?|cement)\b/,required:["variant","quantity"],allowCrossBrandRanking:false},
  {id:"anesthetic",label:"Anestesia",signal:/\b(anestesicos?|anestesias?|articaina|lidocaina)\b/,required:["variant","quantity"],allowCrossBrandRanking:false},
  {id:"general",label:"Material dental",signal:/$^/,required:[],allowCrossBrandRanking:false}
];
const normal=(s:string)=>normalizeName(s).replace(/\s+/g," ").trim();
const detect=(s:string,matches:Array<[string,RegExp]>)=>matches.find(([,re])=>re.test(s))?.[0];
export function inferProfile(text:string):ProfileId {
  return PROFILES.find(p=>p.id!=="general"&&p.signal.test(normal(text)))?.id??"general";
}
export function profileForSearch(query:string,groups:LiveSearchGroup[]):ProfileId{
  const fromQuery=inferProfile(query);
  if(fromQuery!=="general")return fromQuery;
  const counts=new Map<ProfileId,number>();
  for(const g of groups){
    const id=inferProfile(g.label);
    if(id!=="general")counts.set(id,(counts.get(id)??0)+1);
  }
  const sorted=[...counts].sort((a,b)=>b[1]-a[1]);
  return sorted.length===1?sorted[0][0]:"general";
}
export interface SearchSpecs {properties:SearchFilters;unit?:string;count?:number;conflicts:string[];}
export function extractSpecs(value:string):SearchFilters {
  const s=normal(value.replace(/\b([a-d]\d),(\d)\b/gi,"$1.$2"));
  const material=detect(s,[["Nitrilo",/\bnitrilo\b/],["Látex",/\blatex\b/],["Vinilo",/\bvinilo\b/]]);
  const powder=detect(s,[["Sin polvo",/\bsin polvo\b/],["Con polvo",/\bcon polvo\b/]]);
  const sterile=detect(s,[["No estéril",/\b(no esteril(?:es)?|sin esterilizar)\b/],["Estéril",/\besteril(?:es)?\b/]]);
  const color=detect(s,[["Azul",/\bazules?\b/],["Blanco",/\bblancos?\b/],["Negro",/\bnegros?\b/]]);
  const presentation=detect(s,[
    ["Jeringa",/\b(syringe|jeringas?)\b/],["Cápsulas",/\b(capsule|capsulas?)\b/],
    ["Caja",/\bcaja\b/],["Kit",/\bkit\b/],["Bote",/\bbote\b/]
  ]);
  const shade=s.match(/\b([a-d]\d(?:\.\d)?)\b/)?.[1]?.toUpperCase();
  const size=s.match(/\btalla\s*(?:n[º°o.]?\s*)?(xxl|xl|xs|s|m|l|\d+(?:[.,]\d+)?)\b/)?.[1]
    ??s.match(/\bn[º°o.]\s*(\d+(?:[.,]\d+)?)\b/)?.[1];
  const quantity=s.match(/\b(\d+(?:[.,]\d+)?)\s*(g|gr|ml|mg|uds?\.?|unidades)\b/)?.[0];
  const normalizedQuantity=quantity?.replace(/\s+/g," ").replace(/\bgr\b/,"g").replace(/\b(?:uds?\.?|unidades)\b/,"ud").replace(",",".");
  return {material,powder,sterile,color,presentation,shade,size:size?.toUpperCase().replace(",","."),quantity:normalizedQuantity};
}
export function specsForGroup(group:LiveSearchGroup,offer?:SupplierOffer):SearchSpecs {
  // Structured metadata takes precedence; conflicting text is flagged.
  const base=extractSpecs([group.label,group.product.variant,group.product.shade].filter(Boolean).join(" "));
  const own=offer?extractSpecs(offer.rawName):{};
  const properties:SearchFilters={};
  const conflicts:string[]=[];
  for(const key of facetOrder){
    const a=base[key],b=own[key];
    if(a&&b&&a!==b){conflicts.push("Atributo contradictorio: "+facetLabels[key]);continue;}
    properties[key]=b??a;
  }
  const manufacturer=offer?.manufacturer??group.product.manufacturer;
  if(manufacturer)properties.manufacturer=manufacturer;
  if(offer?.shade) {
    const normalized=offer.shade.toUpperCase().replace(",",".");
    if(properties.shade&&properties.shade!==normalized)conflicts.push("Tono contradictorio");
    properties.shade=normalized;
  }
  if(offer?.variant)properties.variant=offer.variant;
  if(offer?.presentation){
    const expected=extractSpecs(offer.presentation).presentation??offer.presentation;
    if(properties.presentation&&normal(properties.presentation)!==normal(expected))conflicts.push("Presentación contradictoria");
    properties.presentation=expected;
  }
  const unit=normalizeUnit(offer?.unit??group.product.unit);
  const count=offer?offer.quantity:group.product.quantity;
  // Do not infer a pack conversion from absent quantity or ambiguous multiple packs.
  if(unit&&typeof count==="number"&&Number.isFinite(count)&&count>0&&
     (offer?.packCount===undefined||offer.packCount===1)){
    const displayUnit=unit==="unit"?"ud":unit;
    const formatted=count+" "+displayUnit;
    if(properties.quantity){
      const parsed=properties.quantity.match(/^(\d+(?:\.\d+)?) (g|ml|mg|ud)$/);
      if(parsed&&(Number(parsed[1])!==count||parsed[2]!==displayUnit))conflicts.push("Cantidad contradictoria");
    }else properties.quantity=formatted;
  }
  return {properties,unit,count,conflicts};
}
export interface UniversalOffer {
  id:string;groupId:string;name:string;reference?:string;supplierId:string;
  productUrl:string;publishedPrice:number;properties:SearchFilters;
  unit?:string;count?:number;effectiveTotal?:number;normalizedCost?:number;
  normalizedBasis?:string;eligible:boolean;issues:string[];
}
export interface UniversalProduct {
  group:LiveSearchGroup;specs:SearchSpecs;best?:UniversalOffer;offers:UniversalOffer[];
}
const validHttps=(value:string)=>{try{return new URL(value).protocol==="https:";}catch{return false;}};
export function assessProducts(groups:LiveSearchGroup[],sessionId:string|null):UniversalProduct[]{
  return groups.map(group=>{
    const matches=compareSupplierOffers(group.product,group.offers,1,{
      requiredLiveSessionId:sessionId??"__MISSING_SESSION__"
    }).matches;
    const offers=matches.map((match,index):UniversalOffer=>{
      const o=match.offer;
      const spec=specsForGroup(group,o);
      const issues=[...spec.conflicts];
      if(!match.eligibleForRanking||!match.pricing)issues.push("Identidad, sesión, stock o coste no comprobados");
      if(!validHttps(o.productUrl))issues.push("URL no verificada");
      const eligible=issues.length===0&&!!match.pricing;
      const count=spec.count;
      const unit=spec.unit;
      const normalizable=eligible&&!!unit&&count!==undefined&&count>0&&
        ["unit","g","ml","mg"].includes(unit);
      return {
        id:group.id+"|"+o.supplierId+"|"+(o.supplierSku??index),groupId:group.id,
        name:o.rawName,reference:o.manufacturerReference??o.supplierSku,
        supplierId:o.supplierId,productUrl:o.productUrl,
        publishedPrice:o.salePrice??o.regularPrice,properties:spec.properties,
        unit,count,eligible,issues,
        effectiveTotal:eligible?match.pricing?.effectiveTotalCost:undefined,
        normalizedBasis:normalizable?(unit==="unit"?"100 ud":"1 "+unit):undefined,
        normalizedCost:normalizable?Math.round(match.pricing!.effectiveTotalCost/(count!)*(unit==="unit"?100:1)*100)/100:undefined
      };
    });
    const best=offers.filter(o=>o.eligible&&o.effectiveTotal!==undefined)
      .sort((a,b)=>a.effectiveTotal!-b.effectiveTotal!)[0];
    return {group,specs:specsForGroup(group),offers,best};
  });
}
export function getAvailableFacets(products:UniversalProduct[]):Array<{key:SearchFacet;values:Array<{value:string;count:number}>}>{
  return facetOrder.map(key=>{
    const counts=new Map<string,number>();
    for(const product of products){
      const distinct=new Set(product.offers.map(o=>o.properties[key]).filter((v):v is string=>Boolean(v)));
      // Count candidate products, not repeated supplier offers.
      if(!distinct.size&&product.specs.properties[key])distinct.add(product.specs.properties[key]!);
      for(const value of distinct)counts.set(value,(counts.get(value)??0)+1);
    }
    return {key,values:[...counts].map(([value,count])=>({value,count})).sort((a,b)=>b.count-a.count)};
  }).filter(f=>f.values.length>0);
}
export function filterProducts(products:UniversalProduct[],filters:SearchFilters):UniversalProduct[]{
  return products.filter(p=>p.offers.length
    ?p.offers.some(o=>facetOrder.every(k=>!filters[k]||o.properties[k]===filters[k]))
    :facetOrder.every(k=>!filters[k]||p.specs.properties[k]===filters[k]));
}
export interface AlternativeResult {profile:ProfileId;ranked:UniversalOffer[];unverified:UniversalOffer[];reason?:string;}
export function assessAlternatives(products:UniversalProduct[],filters:SearchFilters,profileId:ProfileId):AlternativeResult{
  const profile=PROFILES.find(p=>p.id===profileId)!;
  const missing=profile.required.filter(k=>!filters[k]);
  const candidates=products.filter(p=>profileId==="general"||inferProfile(p.group.label)===profileId)
    .flatMap(p=>p.offers)
    .filter(o=>facetOrder.every(k=>!filters[k]||o.properties[k]===filters[k]));
  // The universal UI always works. Automatic cross-brand price ranking needs
  // validated category rules, a single measurement unit, and full specs.
  const reason=!profile.allowCrossBrandRanking
    ?"La identidad funcional entre marcas no está demostrada. Se muestran opciones individuales, sin declararlas equivalentes."
    :missing.length?"Selecciona: "+missing.map(k=>facetLabels[k]).join(", ")
    :undefined;
  const possible=candidates.filter(o=>o.eligible&&o.normalizedCost!==undefined);
  const basis=new Set(possible.map(o=>o.normalizedBasis));
  const uniform=basis.size===1;
  const ranked=reason||!uniform?[]:possible.sort((a,b)=>a.normalizedCost!-b.normalizedCost!);
  const rankedIds=new Set(ranked.map(o=>o.id));
  return {
    profile:profileId,ranked,unverified:candidates.filter(o=>!rankedIds.has(o.id)),
    reason:reason??(!uniform&&possible.length>1?"Los productos tienen unidades de medida distintas.":undefined)
  };
}
export function profileLabel(id:ProfileId):string{return PROFILES.find(p=>p.id===id)!.label;}
