import type { SupplierOffer } from "../types/domain";

export interface LivePriceResponse {
  productId:string;
  sessionId:string;
  requestedAt:string;
  completedAt:string;
  offers:SupplierOffer[];
  errors:Array<{supplierId:string;message:string}>;
}

export async function fetchLivePrices(productId:string):Promise<LivePriceResponse>{
  const base=(import.meta.env.VITE_LIVE_API_URL as string|undefined)?.replace(/\/$/,"");
  if(!base) throw new Error("LIVE_API_NOT_CONFIGURED");
  const response=await fetch(base+"/live-prices?productId="+encodeURIComponent(productId),{
    method:"GET",
    headers:{accept:"application/json"},
    cache:"no-store"
  });
  if(!response.ok) throw new Error("LIVE_API_HTTP_"+response.status);
  return response.json() as Promise<LivePriceResponse>;
}
