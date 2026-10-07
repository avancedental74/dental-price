import type { CanonicalProduct, SupplierOffer } from "../types/domain";
import type { PriceObservation } from "../domain/history";

export interface ConnectorStatus {
  supplierId:string; productId?:string; status:"green"|"amber"|"red"; checkedAt:string; message:string;
  verificationStatus?:"verified"|"failed"|"manual_required"; matchStatus?:"EXACT"|"HIGH_CONFIDENCE"|"REVIEW_REQUIRED"|"REJECTED"; purchasable?:boolean;
}
export interface PublicMetrics {
  generatedAt:string; verifiedOffers:number; purchasableOffers:number; unavailableOffers:number; lowStockOffers:number;
  productsWithTwoOrMoreVerifiedSuppliers:number; productsWithTwoOrMorePurchasableSuppliers:number; automaticSuppliers:number; supplierOfferCounts:Record<string,number>;
}
export interface PublicData { products:CanonicalProduct[]; offers:SupplierOffer[]; history:PriceObservation[]; connectors:ConnectorStatus[]; metrics:PublicMetrics; }

async function json<T>(name:string):Promise<T>{
  const base=import.meta.env.BASE_URL;
  const response=await fetch(base+"data/"+name,{cache:"no-store"});
  if(!response.ok) throw new Error("No se pudo cargar "+name);
  return response.json() as Promise<T>;
}

export async function loadPublicData():Promise<PublicData>{
  const [products,offers,history,connectors,metrics]=await Promise.all([
    json<CanonicalProduct[]>("products.json"),
    json<SupplierOffer[]>("current-prices.json"),
    json<PriceObservation[]>("price-history.json"),
    json<ConnectorStatus[]>("connector-status.json"),
    json<PublicMetrics>("metrics.json")
  ]);
  return {products,offers,history,connectors,metrics};
}