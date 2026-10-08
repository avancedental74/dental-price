import type { CanonicalProduct, SupplierOffer } from "../types/domain";
import type { PriceObservation } from "../domain/history";
import { applyAnomalyStatus } from "../domain/anomaly";
import { normalizeName, normalizeReference } from "../domain/matching/normalization";
import { browserProtectedSupplierIds, liveAutomaticSupplierIds } from "../connectors/live-supplier-registry";

export interface LiveSearchGroup {
  id:string;
  label:string;
  manufacturerReference?:string;
  product:CanonicalProduct;
  offers:SupplierOffer[];
}

export interface LiveCatalogSearchResponse {
  query:string;
  sessionId:string;
  requestedAt:string;
  completedAt:string;
  groups:LiveSearchGroup[];
  errors:Array<{supplierId:string;message:string}>;
}

interface SupplierSearchResponse {
  query:string;
  supplierId:string;
  sessionId:string;
  requestedAt:string;
  completedAt:string;
  offers:SupplierOffer[];
  error?:string|null;
  noMatch?:boolean;
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

function groupOffers(offers:SupplierOffer[]):LiveSearchGroup[]{
  const buckets:Array<{key:string;offers:SupplierOffer[]}>=[];

  for(const offer of offers.filter(o=>Boolean(normalizeReference(o.manufacturerReference)))){
    const ref=normalizeReference(offer.manufacturerReference)!;
    const existing=buckets.find(bucket=>bucket.key==="ref:"+ref);
    if(existing)existing.offers.push(offer);
    else buckets.push({key:"ref:"+ref,offers:[offer]});
  }

  for(const offer of offers.filter(o=>!normalizeReference(o.manufacturerReference))){
    const candidates=buckets
      .map(bucket=>{
        const representative=bucket.offers[0]!;
        return {bucket,score:criticalCompatible(offer,representative)?tokenSimilarity(offer,representative):0};
      })
      .filter(x=>x.score>=0.72)
      .sort((a,b)=>b.score-a.score);

    const unambiguous=candidates[0]&&(!candidates[1]||candidates[0].score-candidates[1].score>=0.08);
    if(unambiguous){
      candidates[0].bucket.offers.push(offer);
      continue;
    }

    const fallback=normalizeName(offer.rawName).replace(/\b(?:oferta|promo|promocion)\b/g,"").trim().slice(0,100);
    const existing=buckets.find(bucket=>bucket.key==="name:"+fallback);
    if(existing)existing.offers.push(offer);
    else buckets.push({key:"name:"+fallback,offers:[offer]});
  }

  return buckets.map(({key,offers:group})=>{
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
    return {id:product.id,label:representative.rawName,manufacturerReference:representative.manufacturerReference,product,offers:group};
  }).sort((a,b)=>{
    const suppliersA=new Set(a.offers.map(o=>o.supplierId)).size;
    const suppliersB=new Set(b.offers.map(o=>o.supplierId)).size;
    return suppliersB-suppliersA||b.offers.length-a.offers.length;
  });
}

export async function searchLiveCatalog(query:string,previousHistory:PriceObservation[]=[],sessionIdOverride?:string):Promise<LiveCatalogSearchResponse>{
  const base=apiBase();
  const sessionId=sessionIdOverride?.trim()||crypto.randomUUID();
  const requestedAt=new Date().toISOString();
  const settled=await Promise.all(liveAutomaticSuppliers.map(async supplierId=>{
    try{
      const url=base+"/search-supplier?q="+encodeURIComponent(query)+"&supplier="+encodeURIComponent(supplierId)+"&sessionId="+encodeURIComponent(sessionId);
      const response=await fetch(url,{method:"GET",headers:{accept:"application/json"},cache:"no-store"});
      if(!response.ok) return {supplierId,offers:[] as SupplierOffer[],error:"HTTP "+response.status};
      const data=await response.json() as SupplierSearchResponse;
      return {supplierId,offers:data.offers??[],error:data.error??null,noMatch:Boolean(data.noMatch)};
    }catch(error){
      return {supplierId,offers:[] as SupplierOffer[],error:error instanceof Error?error.message:"SEARCH_ERROR"};
    }
  }));
  const offers=applyClientHistorySafety(settled.flatMap(x=>x.offers),previousHistory);
  return {
    query,sessionId,requestedAt,completedAt:new Date().toISOString(),
    groups:groupOffers(offers),
    errors:settled.filter(x=>x.error).map(x=>({supplierId:x.supplierId,message:x.error!}))
  };
}
