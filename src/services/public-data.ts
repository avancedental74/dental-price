import type { CanonicalProduct, SupplierOffer } from "../types/domain";
import type { PriceObservation } from "../domain/history";

export interface ConnectorStatus { supplierId:string; productId?:string; status:"green"|"amber"|"red"; checkedAt:string; message:string; }
export interface PublicData { products:CanonicalProduct[]; offers:SupplierOffer[]; history:PriceObservation[]; connectors:ConnectorStatus[]; }

async function json<T>(name:string):Promise<T>{
  const base=import.meta.env.BASE_URL;
  const response=await fetch(base+"data/"+name,{cache:"no-store"});
  if(!response.ok) throw new Error("No se pudo cargar "+name);
  return response.json() as Promise<T>;
}

export async function loadPublicData():Promise<PublicData>{
  const [products,offers,history,connectors]=await Promise.all([
    json<CanonicalProduct[]>("products.json"),
    json<SupplierOffer[]>("current-prices.json"),
    json<PriceObservation[]>("price-history.json"),
    json<ConnectorStatus[]>("connector-status.json")
  ]);
  return {products,offers,history,connectors};
}