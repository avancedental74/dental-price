import {readFileSync} from "node:fs";
import {normalizeName} from "../src/domain/matching/normalization";
import type {SearchSupplierId} from "../src/connectors/live-supplier-registry";

export interface OfflineDiscoveryProduct {
  supplierId:SearchSupplierId;
  productUrl:string;
  rawName:string;
  normalizedName:string;
  supplierSku?:string;
  manufacturer?:string;
  manufacturerReference?:string;
  eanGtin?:string;
  variant?:string;
  shade?:string;
  presentation?:string;
  quantity?:number;
  unit?:string;
  packCount?:number;
  firstSeenAt:string;
  lastSeenAt:string;
  source:"sitemap"|"store-api"|"manual-source";
  sourceUrl:string;
  discoveryStatus:"active"|"stale"|"retired";
  detailStatus:"not_fetched"|"fetched"|"failed";
}

export interface OfflineDiscoveryState {
  generatedAt:string;
  sources:Array<{
    supplierId:SearchSupplierId;
    source:string;
    sourceUrl:string;
    fetchedAt:string;
    status:"ok"|"partial"|"error";
    scope:"full"|"partial";
    discovered:number;
    error?:string;
  }>;
  products:OfflineDiscoveryProduct[];
}

export interface DiscoveredCandidate {
  supplierId:SearchSupplierId;
  productUrl:string;
  rawName:string;
  supplierSku?:string;
  manufacturer?:string;
  manufacturerReference?:string;
  eanGtin?:string;
  source:"sitemap"|"store-api"|"manual-source";
  sourceUrl:string;
  detailStatus:"not_fetched"|"fetched"|"failed";
}

export function readDiscoveryState(path:string):OfflineDiscoveryState{
  try{
    return JSON.parse(readFileSync(path,"utf8")) as OfflineDiscoveryState;
  }catch{
    return {generatedAt:new Date(0).toISOString(),sources:[],products:[]};
  }
}

export function slugTitle(url:string){
  try{
    const parsed=new URL(url);
    const segment=parsed.pathname.split("/").filter(Boolean).at(-1)??parsed.hostname;
    return segment.replace(/[-_]+/g," ").replace(/\s+/g," ").trim();
  }catch{
    return url.replace(/[-_]+/g," ").replace(/\s+/g," ").trim();
  }
}

export function cleanText(value:string){
  return value.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&#8211;|&ndash;/g,"-").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
}

export function manufacturerReferenceFromText(text:string){
  const cleaned=cleanText(text);
  const match=cleaned.match(/\b(?:Ref(?:\.|erencia)?(?:\s+fabricante)?|REF)\s*:?\s*([A-Z0-9][A-Z0-9._/-]{2,})\b/i);
  const candidate=match?.[1]?.replace(/[.,;:]+$/,"");
  if(!candidate)return undefined;
  const compact=candidate.replace(/[^a-z0-9]/gi,"");
  if(compact.length<4)return undefined;
  if(!/\d/.test(compact))return undefined;
  if(/^[a-z]+$/i.test(compact)&&compact.length<8)return undefined;
  return candidate;
}

export function mergeDiscoveryState(previous:OfflineDiscoveryState,candidates:DiscoveredCandidate[],sources:OfflineDiscoveryState["sources"],now:string){
  const byKey=new Map<string,OfflineDiscoveryProduct>();
  for(const product of previous.products){
    byKey.set(product.supplierId+"|"+product.productUrl.split("#")[0],product);
  }
  const seen=new Set<string>();
  for(const candidate of candidates){
    if(!/^https:\/\//i.test(candidate.productUrl))continue;
    const rawName=cleanText(candidate.rawName||slugTitle(candidate.productUrl));
    if(rawName.length<3)continue;
    const key=candidate.supplierId+"|"+candidate.productUrl.split("#")[0];
    const prior=byKey.get(key);
    seen.add(key);
    byKey.set(key,{
      ...prior,
      supplierId:candidate.supplierId,
      productUrl:candidate.productUrl.split("#")[0],
      rawName,
      normalizedName:normalizeName([rawName,candidate.manufacturer??"",candidate.manufacturerReference??"",candidate.supplierSku??""].join(" ")),
      supplierSku:candidate.supplierSku??prior?.supplierSku,
      manufacturer:candidate.manufacturer??prior?.manufacturer,
      manufacturerReference:candidate.detailStatus==="fetched"?candidate.manufacturerReference:candidate.manufacturerReference??prior?.manufacturerReference,
      eanGtin:candidate.eanGtin??prior?.eanGtin,
      firstSeenAt:prior?.firstSeenAt??now,
      lastSeenAt:now,
      source:candidate.source,
      sourceUrl:candidate.sourceUrl,
      discoveryStatus:"active",
      detailStatus:candidate.detailStatus
    });
  }
  const visitedFullSuppliers=new Set(sources.filter(source=>source.status==="ok"&&source.scope==="full").map(source=>source.supplierId));
  for(const [key,product] of byKey){
    if(seen.has(key))continue;
    if(visitedFullSuppliers.has(product.supplierId))byKey.set(key,{...product,discoveryStatus:"retired"});
    else byKey.set(key,{...product,discoveryStatus:product.discoveryStatus==="active"?"stale":product.discoveryStatus});
  }
  return {
    generatedAt:now,
    sources,
    products:[...byKey.values()].sort((a,b)=>a.supplierId.localeCompare(b.supplierId)||a.rawName.localeCompare(b.rawName))
  };
}
