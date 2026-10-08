import type { CanonicalProduct, SupplierOffer } from "../types/domain";
import type { PriceObservation } from "../domain/history";
import { applyAnomalyStatus } from "../domain/anomaly";
import { normalizeManufacturer, normalizeName, normalizeReference } from "../domain/matching/normalization";
import { browserProtectedSupplierIds, liveAutomaticSupplierIds } from "../connectors/live-supplier-registry";
import {planSupplierQueries,mergeSupplierQueryOffers} from "./search-expansion";
import {mapWithConcurrency} from "./supplier-concurrency";

export interface LiveSearchGroup {
  id:string;
  label:string;
  manufacturerReference?:string;
  identityLevel:LiveIdentityLevel;
  identityReasons:string[];
  product:CanonicalProduct;
  offers:SupplierOffer[];
}

export type LiveIdentityLevel=
  |"exact_identity"
  |"probable_identity"
  |"insufficient_identity";

export interface LiveDiscoveryRecord {
  id:string;
  supplierId:string;
  supplierSku?:string;
  manufacturerReference?:string;
  rawName:string;
  productUrl:string;
  groupId?:string;
  classification:
    |"exact_identity"
    |"probable_identity"
    |"identity_insufficient"
    |"related_accessory"
    |"not_comparable";
  reasons:string[];
  priceVerification?:SupplierOffer["priceVerification"];
  sourceStatus:SupplierOffer["sourceStatus"];
}

export interface LiveCatalogSearchResponse {
  query:string;
  sessionId:string;
  requestedAt:string;
  completedAt:string;
  groups:LiveSearchGroup[];
  discovery:LiveDiscoveryRecord[];
  errors:Array<{supplierId:string;message:string}>;
  depth:SearchDepth;
  coverage:Array<{supplierId:string;offers:number;candidateLimitReached:boolean;queries:number;partialErrors:number;status:"results"|"no_match"|"partial"|"error"}>;
}

export type SearchDepth="standard"|"extended";

interface SupplierSearchResponse {
  query:string;
  supplierId:string;
  sessionId:string;
  requestedAt:string;
  completedAt:string;
  offers:SupplierOffer[];
  error?:string|null;
  noMatch?:boolean;
  partial?:boolean;
  candidateLimitReached?:boolean;
}

export const liveAutomaticSuppliers=liveAutomaticSupplierIds;
export const browserVerificationSuppliers=browserProtectedSupplierIds;

function apiBase(){
  const raw=import.meta.env.VITE_LIVE_API_URL as string|undefined;
  if(!raw) throw new Error("LIVE_API_NOT_CONFIGURED");
  return raw.endsWith("/")?raw.slice(0,-1):raw;
}

function observationTime(item:PriceObservation){
  const value=new Date(item.lastSeenAt??item.observedAt).getTime();
  return Number.isFinite(value)?value:0;
}

export function applyClientHistorySafety(offers:SupplierOffer[],history:PriceObservation[]):SupplierOffer[]{
  const bySku=new Map<string,PriceObservation>();
  const byUrl=new Map<string,PriceObservation>();
  for(const item of history){
    const sku=normalizeReference(item.supplierSku);
    if(sku){
      const key=item.supplierId+"|"+sku;
      const previous=bySku.get(key);
      if(!previous||observationTime(item)>observationTime(previous))bySku.set(key,item);
    }
    if(item.sourceUrl){
      const key=item.supplierId+"|"+item.sourceUrl;
      const previous=byUrl.get(key);
      if(!previous||observationTime(item)>observationTime(previous))byUrl.set(key,item);
    }
  }
  return offers.map(offer=>{
    const sku=normalizeReference(offer.supplierSku);
    const previous=sku?bySku.get(offer.supplierId+"|"+sku):byUrl.get(offer.supplierId+"|"+offer.productUrl);
    return applyAnomalyStatus(offer,previous);
  });
}

function safeId(value:string){
  return normalizeName(value).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||String(Date.now());
}

const weakTokens=new Set(["de","del","la","el","para","con","sin","the","and","plus","producto","dental","unidad","unidades"]);

function nameTokens(offer:SupplierOffer){
  return new Set(
    normalizeName([offer.rawName,offer.manufacturer??""].join(" "))
      .split(" ")
      .filter(token=>token.length>=2&&!weakTokens.has(token))
  );
}

function tokenSimilarity(a:SupplierOffer,b:SupplierOffer){
  const aa=nameTokens(a),bb=nameTokens(b);
  if(!aa.size||!bb.size)return 0;
  let intersection=0;
  for(const token of aa)if(bb.has(token))intersection++;
  return intersection/Math.min(aa.size,bb.size);
}

function criticalCompatible(a:SupplierOffer,b:SupplierOffer){
  // Separate distinct seller SKUs from the same shop even when their names match.
  if(a.supplierId===b.supplierId&&a.supplierSku&&b.supplierSku&&
     normalizeReference(a.supplierSku)!==normalizeReference(b.supplierSku))return false;
  const am=normalizeManufacturer(a.manufacturer),bm=normalizeManufacturer(b.manufacturer);
  if(am&&bm&&am!==bm)return false;
  if(a.eanGtin&&b.eanGtin&&normalizeReference(a.eanGtin)!==normalizeReference(b.eanGtin))return false;
  if(a.presentation&&b.presentation&&normalizeName(a.presentation)!==normalizeName(b.presentation))return false;
  if(a.unit&&b.unit&&normalizeName(a.unit)!==normalizeName(b.unit))return false;
  if(typeof a.quantity==="number"&&typeof b.quantity==="number"&&Math.abs(a.quantity-b.quantity)>0.001)return false;
  if(typeof a.packCount==="number"&&typeof b.packCount==="number"&&a.packCount!==b.packCount)return false;
  if(a.shade&&b.shade&&normalizeName(a.shade)!==normalizeName(b.shade))return false;
  if(a.variant&&b.variant&&normalizeName(a.variant)!==normalizeName(b.variant))return false;
  return true;
}

function offerIdentityCompleteness(offer:SupplierOffer){
  let score=0;
  if(offer.manufacturerReference)score+=40;
  if(offer.eanGtin)score+=50;
  if(offer.manufacturer)score+=8;
  if(offer.presentation)score+=6;
  if(typeof offer.quantity==="number"&&offer.quantity>0&&offer.unit)score+=6;
  if(typeof offer.packCount==="number"&&offer.packCount>0)score+=5;
  if(offer.variant)score+=4;
  if(offer.shade)score+=4;
  return score;
}

function mergeIdentityLevel(current:LiveIdentityLevel,next:LiveIdentityLevel):LiveIdentityLevel{
  if(current==="insufficient_identity"||next==="insufficient_identity")return "insufficient_identity";
  if(current==="probable_identity"||next==="probable_identity")return "probable_identity";
  return "exact_identity";
}

function discoveryId(offer:SupplierOffer,index:number){
  return [
    offer.supplierId,
    normalizeReference(offer.supplierSku)??safeId(offer.productUrl||offer.rawName),
    normalizeReference(offer.manufacturerReference)??"",
    index
  ].join("|");
}

export function buildDiscoveryRecords(groups:LiveSearchGroup[]):LiveDiscoveryRecord[]{
  return groups.flatMap(group=>group.offers.map((offer,index):LiveDiscoveryRecord=>({
    id:discoveryId(offer,index),
    supplierId:offer.supplierId,
    supplierSku:offer.supplierSku,
    manufacturerReference:offer.manufacturerReference,
    rawName:offer.rawName,
    productUrl:offer.productUrl,
    groupId:group.id,
    classification:group.identityLevel==="exact_identity"?"exact_identity":
      group.identityLevel==="probable_identity"?"probable_identity":"identity_insufficient",
    reasons:group.identityReasons,
    priceVerification:offer.priceVerification,
    sourceStatus:offer.sourceStatus
  })));
}

export function groupLiveOffers(offers:SupplierOffer[]):LiveSearchGroup[]{
  const buckets:Array<{key:string;ref?:string;offers:SupplierOffer[];identityLevel:LiveIdentityLevel;reasons:Set<string>}>=[];

  for(const offer of offers.filter(o=>Boolean(normalizeReference(o.manufacturerReference)))){
    const ref=normalizeReference(offer.manufacturerReference)!;
    // Identical-looking references are not enough if the brand, EAN, shade
    // or pack details contradict each other.
    const existing=buckets.find(bucket=>bucket.ref===ref&&bucket.offers.every(existing=>criticalCompatible(offer,existing)));
    if(existing)existing.offers.push(offer);
    else{
      const conflicting=buckets.filter(bucket=>bucket.ref===ref).length;
      buckets.push({
        key:"ref:"+ref+(conflicting?"|variant-"+conflicting:""),
        ref,offers:[offer],identityLevel:"exact_identity",
        reasons:new Set([conflicting?"Referencia fuerte compartida, pero variante separada por atributos críticos":"Referencia de fabricante acreditada"])
      });
    }
  }

  for(const offer of offers.filter(o=>!normalizeReference(o.manufacturerReference))){
    const candidates=buckets
      .map(bucket=>{
        const representative=bucket.offers[0]!;
        return {bucket,score:bucket.offers.every(existing=>criticalCompatible(offer,existing))?tokenSimilarity(offer,representative):0};
      })
      .filter(x=>x.score>=0.65)
      .sort((a,b)=>b.score-a.score);

    const unambiguous=candidates[0]&&(!candidates[1]||candidates[0].score-candidates[1].score>=0.08);
    if(unambiguous){
      candidates[0].bucket.offers.push(offer);
      candidates[0].bucket.identityLevel=mergeIdentityLevel(candidates[0].bucket.identityLevel,"probable_identity");
      candidates[0].bucket.reasons.add("Oferta sin referencia de fabricante agrupada por nombre compatible y atributos críticos no contradictorios");
      continue;
    }

    const fallback=normalizeName(offer.rawName).replace(/\b(?:oferta|promo|promocion)\b/g,"").trim().slice(0,100);
    const existing=buckets.find(bucket=>bucket.key.startsWith("name:"+fallback)&&
      bucket.offers.every(other=>criticalCompatible(offer,other)));
    if(existing){
      existing.offers.push(offer);
      existing.identityLevel=mergeIdentityLevel(existing.identityLevel,"insufficient_identity");
      existing.reasons.add("Sin identificador fuerte; agrupación conservadora por nombre y atributos");
    }
    else{
      const variants=buckets.filter(bucket=>bucket.key.startsWith("name:"+fallback)).length;
      buckets.push({
        key:"name:"+fallback+(variants?"|variant-"+variants:""),
        offers:[offer],identityLevel:"insufficient_identity",
        reasons:new Set(["Sin referencia de fabricante ni EAN; identidad insuficiente para ranking exacto"])
      });
    }
  }

  return buckets.map(({key,offers:group,identityLevel,reasons})=>{
    const representative=[...group].sort((a,b)=>offerIdentityCompleteness(b)-offerIdentityCompleteness(a))[0]!;
    const product:CanonicalProduct={
      id:"live-"+safeId(key),
      manufacturer:representative.manufacturer??"",
      family:representative.rawName,
      productName:representative.rawName,
      variant:representative.variant,
      shade:representative.shade,
      presentation:representative.presentation??"",
      quantity:representative.quantity??0,
      unit:representative.unit??"",
      packCount:representative.packCount??0,
      manufacturerReference:representative.manufacturerReference,
      category:"Búsqueda live",
      normalizedName:representative.normalizedName||normalizeName(representative.rawName),
      active:true
    };
    return {
      id:product.id,label:representative.rawName,manufacturerReference:representative.manufacturerReference,
      identityLevel,identityReasons:[...reasons],product,offers:group
    };
  }).sort((a,b)=>{
    const suppliersA=new Set(a.offers.map(o=>o.supplierId)).size;
    const suppliersB=new Set(b.offers.map(o=>o.supplierId)).size;
    return suppliersB-suppliersA||b.offers.length-a.offers.length;
  });
}

export async function searchLiveCatalog(query:string,previousHistory:PriceObservation[]=[],sessionIdOverride?:string,depth:SearchDepth="standard"):Promise<LiveCatalogSearchResponse>{
  const base=apiBase();
  const sessionId=sessionIdOverride?.trim()||crypto.randomUUID();
  const requestedAt=new Date().toISOString();
  const queries=planSupplierQueries(query,depth==="extended");
  const settled=await mapWithConcurrency(liveAutomaticSuppliers,async supplierId=>{
    // In extended mode try at most two semantics-preserving terms per provider.
    // The requests share a session so validation remains scoped to this search.
    const fetchTerm=async(term:string,requestDepth:SearchDepth)=>{
      try{
        const url=base+"/search-supplier?q="+encodeURIComponent(term)
          +"&supplier="+encodeURIComponent(supplierId)
          +"&sessionId="+encodeURIComponent(sessionId)+"&depth="+requestDepth;
        const response=await fetch(url,{method:"GET",headers:{accept:"application/json"},cache:"no-store"});
        if(!response.ok)return {offers:[] as SupplierOffer[],error:"HTTP "+response.status,candidateLimitReached:false};
        const data=await response.json() as SupplierSearchResponse;
        if(data.supplierId!==supplierId||data.sessionId!==sessionId)
          return {offers:[] as SupplierOffer[],error:"RESPONSE_IDENTITY_MISMATCH",candidateLimitReached:false};
        return {
          offers:data.offers??[],
          error:data.partial?null:data.error??null,
          partial:Boolean(data.partial),
          candidateLimitReached:Boolean(data.candidateLimitReached)
        };
      }catch(error){
        return {offers:[] as SupplierOffer[],error:error instanceof Error?error.message:"SEARCH_ERROR",candidateLimitReached:false};
      }
    };
    const attempts=await Promise.all(queries.map(term=>fetchTerm(term,depth)));
    // A single bounded retry for temporary transport/server problems. A
    // failure is never treated as a legitimate empty supplier catalogue.
    const transient=(error:string|null|undefined)=>Boolean(error&&/(?:HTTP 5\d\d|timeout|timed out|abort|network|fetch failed|failed to fetch)/i.test(error));
    if(depth==="standard"&&attempts.every(a=>a.offers.length===0)&&attempts.some(a=>transient(a.error))){
      attempts.push(await fetchTerm(query,"standard"));
    }
    // Improve coverage automatically for suppliers that returned no matches.
    // A hard error is reported, not retried indefinitely. Only one bounded
    // extended pass, with lexical alternatives where available.
    if(depth==="standard"&&attempts.every(a=>!a.error&&a.offers.length===0)){
      const fallbacks=planSupplierQueries(query,true);
      attempts.push(...await Promise.all(fallbacks.map(term=>fetchTerm(term,"extended"))));
    }
    const good=attempts.filter(a=>!a.error);
    const combined=mergeSupplierQueryOffers(good.flatMap(a=>a.offers));
    return {
      supplierId,offers:combined,
      error:good.length?null:attempts.map(a=>a.error).filter(Boolean).join("; "),
      partial:attempts.some(a=>a.partial),
      partialErrors:attempts.filter(a=>a.error).length,
      queries:attempts.length,
      candidateLimitReached:attempts.some(a=>a.candidateLimitReached)
    };
  },2);
  const offers=applyClientHistorySafety(settled.flatMap(x=>x.offers),previousHistory);
  const groups=groupLiveOffers(offers);
  return {
    query,sessionId,requestedAt,completedAt:new Date().toISOString(),
    groups,discovery:buildDiscoveryRecords(groups),depth,
    coverage:settled.map(x=>({supplierId:x.supplierId,offers:x.offers.length,candidateLimitReached:x.candidateLimitReached,queries:x.queries,partialErrors:x.partialErrors,status:x.error?"error" as const:x.offers.length?"results" as const:x.partial?"partial" as const:"no_match" as const})),
    errors:settled.filter(x=>x.error).map(x=>({supplierId:x.supplierId,message:x.error!}))
  };
}
