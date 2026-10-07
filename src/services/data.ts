import type { CanonicalProduct, SupplierOffer } from "../types/domain";
import type { PriceObservation } from "../domain/history";

export interface CurrentPriceEntry {
  productId: string;
  offer: SupplierOffer;
  matchStatus: string;
  matchScore: number;
  collectionMode?: "automatic" | "manual_verified" | "last_known";
}
export interface CurrentPricesPayload { generatedAt: string | null; entries: CurrentPriceEntry[]; }
export interface ConnectorStatusPayload { generatedAt: string | null; suppliers: Record<string,{status:string;checkedAt:string;message:string}>; }
export interface PublicData {
  products: CanonicalProduct[];
  current: CurrentPricesPayload;
  history: PriceObservation[];
  connectors: ConnectorStatusPayload;
}

async function getJson<T>(file:string,fallback:T):Promise<T>{
  try{
    const response=await fetch(`${import.meta.env.BASE_URL}data/${file}`,{cache:"no-store"});
    if(!response.ok) return fallback;
    return await response.json() as T;
  }catch{ return fallback; }
}

export async function loadPublicData():Promise<PublicData>{
  const [products,current,history,connectors]=await Promise.all([
    getJson<CanonicalProduct[]>("products.json",[]),
    getJson<CurrentPricesPayload>("current-prices.json",{generatedAt:null,entries:[]}),
    getJson<PriceObservation[]>("price-history.json",[]),
    getJson<ConnectorStatusPayload>("connector-status.json",{generatedAt:null,suppliers:{}})
  ]);
  return {products,current,history,connectors};
}