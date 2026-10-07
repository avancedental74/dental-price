import products from "../data/products.json";
import seeds from "../data/supplier-seeds.json";
import policies from "../data/supplier-policies.json";
import history from "../data/price-history.json";
import type { CanonicalProduct, SupplierOffer } from "../src/types/domain";
import type { SupplierPolicy } from "../src/domain/supplier-policies";
import type { PriceObservation } from "../src/domain/history";
import { applySupplierPolicy } from "../src/domain/supplier-policies";
import { applyAnomalyStatus } from "../src/domain/anomaly";
import { supplierOfferSchema } from "../src/domain/schemas";
import { fetchDentaltixProduct } from "../src/connectors/dentaltix";
import { fetchDentalCostProduct } from "../src/connectors/dentalcost";
import { fetchDvdProduct } from "../src/connectors/dvd-dental";
import { fetchProclinicProduct } from "../src/connectors/proclinic";
import { fetchDentalIbericaProduct } from "../src/connectors/dental-iberica";
import { fetchDentalExpressProduct } from "../src/connectors/dentalexpress";
import { fetchBrokerDentalProduct } from "../src/connectors/brokerdental";
import { fetchOrtolanProduct } from "../src/connectors/ortolan";
import { matchOfferToProduct } from "../src/domain/matching/matcher";
import { normalizeReference } from "../src/domain/matching/normalization";

type Seed={productId:string;supplierId:string;url:string;acquisitionMode?:"direct"|"manual_verification"};
type Env={ALLOWED_ORIGIN?:string};

const productList=products as CanonicalProduct[];
const seedList=seeds as Seed[];
const policyList=policies as SupplierPolicy[];
const historyList=history as PriceObservation[];

function cors(origin:string|null,env:Env){
  const allowed=env.ALLOWED_ORIGIN ?? "*";
  const value=allowed==="*" ? "*" : allowed;
  return {
    "access-control-allow-origin":value,
    "access-control-allow-methods":"GET,OPTIONS",
    "access-control-allow-headers":"content-type",
    "cache-control":"no-store",
    "vary":"Origin"
  };
}

async function fetchSupplier(seed:Seed):Promise<SupplierOffer[]>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  const timedFetch:typeof fetch=(input,init={})=>fetch(input,{...init,signal:controller.signal});
  try{
    if(seed.supplierId==="dentaltix") return (await fetchDentaltixProduct(seed.url,timedFetch)).offers;
    if(seed.supplierId==="dentalcost") return (await fetchDentalCostProduct(seed.url,timedFetch)).offers;
    if(seed.supplierId==="dvd-dental") return (await fetchDvdProduct(seed.url,timedFetch)).offers;
    if(seed.supplierId==="proclinic") return (await fetchProclinicProduct(seed.url,timedFetch)).offers;
    if(seed.supplierId==="dental-iberica") return (await fetchDentalIbericaProduct(seed.url,timedFetch)).offers;
    if(seed.supplierId==="dentalexpress") return (await fetchDentalExpressProduct(seed.url,timedFetch)).offers;
    if(seed.supplierId==="brokerdental") return (await fetchBrokerDentalProduct(seed.url,timedFetch)).offers;
    if(seed.supplierId==="ortolan") return (await fetchOrtolanProduct(seed.url,timedFetch)).offers;
    return [];
  } finally { clearTimeout(timer); }
}

function previousObservation(productId:string,offer:SupplierOffer):PriceObservation|undefined{
  return historyList
    .filter(h=>h.productId===productId&&h.supplierId===offer.supplierId&&(!offer.supplierSku||!h.supplierSku||h.supplierSku===offer.supplierSku))
    .sort((a,b)=>new Date(b.lastSeenAt||b.observedAt).getTime()-new Date(a.lastSeenAt||a.observedAt).getTime())[0];
}

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const origin=request.headers.get("origin");
    const headers=cors(origin,env);
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers});
    if(request.method!=="GET") return Response.json({error:"METHOD_NOT_ALLOWED"},{status:405,headers});

    const url=new URL(request.url);
    if(url.pathname==="/health") return Response.json({ok:true,at:new Date().toISOString(),suppliers:["dentaltix","dentalcost","dvd-dental","proclinic","dental-iberica","dentalexpress","brokerdental","ortolan"]},{headers});
    if(url.pathname!=="/live-prices") return Response.json({error:"NOT_FOUND"},{status:404,headers});

    const productId=url.searchParams.get("productId") ?? "";
    const product=productList.find(p=>p.id===productId&&p.active);
    if(!product) return Response.json({error:"UNKNOWN_PRODUCT"},{status:404,headers});

    const requestedAt=new Date().toISOString();
    const sessionId=crypto.randomUUID();
    const targetRef=normalizeReference(product.manufacturerReference);
    const direct=seedList.filter(s=>s.productId===productId&&s.acquisitionMode!=="manual_verification");
    const unique=[...new Map(direct.map(s=>[s.supplierId+"|"+s.url,s])).values()];
    const settled=await Promise.all(unique.map(async seed=>{
      try{
        const raw=await fetchSupplier(seed);
        const policy=policyList.find(p=>p.supplierId===seed.supplierId);
        const candidates=raw
          .filter(o=>targetRef&&normalizeReference(o.manufacturerReference)===targetRef)
          .map(o=>applySupplierPolicy(o,policy))
          .map(o=>applyAnomalyStatus(o,previousObservation(productId,o)))
          .map(o=>({...o,verificationKind:"live" as const,verificationSessionId:sessionId,verifiedAt:new Date().toISOString()}))
          .filter(o=>supplierOfferSchema.safeParse(o).success)
          .filter(o=>matchOfferToProduct(product,o).status==="EXACT");
        return {seed,offers:candidates,error:null as string|null};
      }catch(error){
        return {seed,offers:[] as SupplierOffer[],error:error instanceof Error?error.message:"Unknown error"};
      }
    }));

    const offers=settled.flatMap(x=>x.offers);
    const errors=settled.filter(x=>x.error).map(x=>({supplierId:x.seed.supplierId,message:x.error!}));
    return Response.json({productId,sessionId,requestedAt,completedAt:new Date().toISOString(),offers,errors},{headers});
  }
};