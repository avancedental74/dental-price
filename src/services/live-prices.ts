import type { CanonicalProduct, SupplierOffer } from "../types/domain";
import { normalizeName, normalizeReference } from "../domain/matching/normalization";

export interface LivePriceResponse {
  productId:string;
  sessionId:string;
  requestedAt:string;
  completedAt:string;
  offers:SupplierOffer[];
  errors:Array<{supplierId:string;message:string}>;
}

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
}

export const liveAutomaticSuppliers=["dentaltix","dentalcost","dvd-dental","dentalexpress","ortolan"] as const;
export const browserVerificationSuppliers=["proclinic","dental-iberica","brokerdental"] as const;

function apiBase(){
  const raw=import.meta.env.VITE_LIVE_API_URL as string|undefined;
  if(!raw) throw new Error("LIVE_API_NOT_CONFIGURED");
  return raw.endsWith("/")?raw.slice(0,-1):raw;
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
    const representative=group.find(o=>o.manufacturerReference)??group[0]!;
    const product:CanonicalProduct={
      id:"live-"+safeId(key),
      manufacturer:representative.manufacturer??"Desconocido",
      family:representative.rawName,
      productName:representative.rawName,
      variant:representative.variant,
      shade:representative.shade,
      presentation:representative.presentation??"No confirmada",
      quantity:representative.quantity??1,
      unit:representative.unit??"ud",
      packCount:representative.packCount??1,
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

export async function fetchLivePrices(productId:string):Promise<LivePriceResponse>{
  const response=await fetch(apiBase()+"/live-prices?productId="+encodeURIComponent(productId),{
    method:"GET",headers:{accept:"application/json"},cache:"no-store"
  });
  if(!response.ok) throw new Error("LIVE_API_HTTP_"+response.status);
  return response.json() as Promise<LivePriceResponse>;
}

export async function searchLiveCatalog(query:string):Promise<LiveCatalogSearchResponse>{
  const base=apiBase();
  const sessionId=crypto.randomUUID();
  const requestedAt=new Date().toISOString();
  const settled=await Promise.all(liveAutomaticSuppliers.map(async supplierId=>{
    try{
      const url=base+"/search-supplier?q="+encodeURIComponent(query)+"&supplier="+encodeURIComponent(supplierId)+"&sessionId="+encodeURIComponent(sessionId);
      const response=await fetch(url,{method:"GET",headers:{accept:"application/json"},cache:"no-store"});
      if(!response.ok) return {supplierId,offers:[] as SupplierOffer[],error:"HTTP "+response.status};
      const data=await response.json() as SupplierSearchResponse;
      return {supplierId,offers:data.offers??[],error:data.error??null};
    }catch(error){
      return {supplierId,offers:[] as SupplierOffer[],error:error instanceof Error?error.message:"SEARCH_ERROR"};
    }
  }));
  const offers=settled.flatMap(x=>x.offers);
  return {
    query,sessionId,requestedAt,completedAt:new Date().toISOString(),
    groups:groupOffers(offers),
    errors:settled.filter(x=>x.error).map(x=>({supplierId:x.supplierId,message:x.error!}))
  };
}
