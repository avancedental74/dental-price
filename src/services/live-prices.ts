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

const suppliers=["dentaltix","dentalcost","dvd-dental","proclinic","dental-iberica","dentalexpress","brokerdental","ortolan"];

function apiBase(){
  const raw=import.meta.env.VITE_LIVE_API_URL as string|undefined;
  if(!raw) throw new Error("LIVE_API_NOT_CONFIGURED");
  return raw.endsWith("/")?raw.slice(0,-1):raw;
}

function safeId(value:string){
  return normalizeName(value).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||String(Date.now());
}

function groupOffers(offers:SupplierOffer[]):LiveSearchGroup[]{
  const map=new Map<string,SupplierOffer[]>();
  for(const offer of offers){
    const ref=normalizeReference(offer.manufacturerReference);
    const fallback=normalizeName(offer.rawName).replace(/\b(?:oferta|promo|promocion)\b/g,"").trim().slice(0,100);
    const key=ref?"ref:"+ref:"name:"+fallback;
    const current=map.get(key)??[];
    current.push(offer);
    map.set(key,current);
  }
  return [...map.entries()].map(([key,group])=>{
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
  const settled=await Promise.all(suppliers.map(async supplierId=>{
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
