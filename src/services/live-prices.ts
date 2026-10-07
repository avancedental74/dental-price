import type { CanonicalProduct, SupplierOffer } from "../types/domain";

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

function apiBase(){
  const base=(import.meta.env.VITE_LIVE_API_URL as string|undefined)?.replace(/\\/$/,"");
  if(!base) throw new Error("LIVE_API_NOT_CONFIGURED");
  return base;
}

export async function fetchLivePrices(productId:string):Promise<LivePriceResponse>{
  const response=await fetch(apiBase()+"/live-prices?productId="+encodeURIComponent(productId),{
    method:"GET",headers:{accept:"application/json"},cache:"no-store"
  });
  if(!response.ok) throw new Error("LIVE_API_HTTP_"+response.status);
  return response.json() as Promise<LivePriceResponse>;
}

export async function searchLiveCatalog(query:string):Promise<LiveCatalogSearchResponse>{
  const response=await fetch(apiBase()+"/search-live?q="+encodeURIComponent(query),{
    method:"GET",headers:{accept:"application/json"},cache:"no-store"
  });
  if(!response.ok) throw new Error("LIVE_SEARCH_HTTP_"+response.status);
  return response.json() as Promise<LiveCatalogSearchResponse>;
}
