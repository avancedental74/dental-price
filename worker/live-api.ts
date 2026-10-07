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
import { discoverSupplierProductUrls, type SearchSupplierId } from "../src/connectors/live-search";
import { matchOfferToProduct } from "../src/domain/matching/matcher";
import { normalizeName, normalizeReference } from "../src/domain/matching/normalization";

type Seed={productId:string;supplierId:string;url:string;acquisitionMode?:"direct"|"manual_verification"};
type Env={ALLOWED_ORIGIN?:string};
type DynamicGroup={id:string;label:string;manufacturerReference?:string;product:CanonicalProduct;offers:SupplierOffer[]};

const productList=products as CanonicalProduct[];
const seedList=seeds as Seed[];
const policyList=policies as SupplierPolicy[];
const historyList=history as PriceObservation[];
const suppliers:SearchSupplierId[]=["dentaltix","dentalcost","dvd-dental","proclinic","dental-iberica","dentalexpress","brokerdental","ortolan"];

function cors(origin:string|null,env:Env){
  const allowed=env.ALLOWED_ORIGIN ?? "*";
  if(allowed!=="*"&&origin&&origin!==allowed) return null;
  return {
    "access-control-allow-origin":allowed==="*"?"*":allowed,
    "access-control-allow-methods":"GET,OPTIONS",
    "access-control-allow-headers":"content-type",
    "cache-control":"no-store",
    "vary":"Origin"
  };
}

function withTimeout(ms=10000):typeof fetch{
  return async(input,init={})=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),ms);
    try{return await fetch(input,{...init,signal:controller.signal});}
    finally{clearTimeout(timer);}
  };
}

async function fetchSupplierUrl(supplierId:string,productUrl:string,fetchImpl:typeof fetch):Promise<SupplierOffer[]>{
  if(supplierId==="dentaltix") return (await fetchDentaltixProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="dentalcost") return (await fetchDentalCostProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="dvd-dental") return (await fetchDvdProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="proclinic") return (await fetchProclinicProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="dental-iberica") return (await fetchDentalIbericaProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="dentalexpress") return (await fetchDentalExpressProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="brokerdental") return (await fetchBrokerDentalProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="ortolan") return (await fetchOrtolanProduct(productUrl,fetchImpl)).offers;
  return [];
}

async function fetchSupplier(seed:Seed):Promise<SupplierOffer[]>{
  return fetchSupplierUrl(seed.supplierId,seed.url,withTimeout(12000));
}

function previousObservation(productId:string,offer:SupplierOffer):PriceObservation|undefined{
  return historyList
    .filter(h=>h.productId===productId&&h.supplierId===offer.supplierId&&(!offer.supplierSku||!h.supplierSku||h.supplierSku===offer.supplierSku))
    .sort((a,b)=>new Date(b.lastSeenAt||b.observedAt).getTime()-new Date(a.lastSeenAt||a.observedAt).getTime())[0];
}

function queryLooksLikeReference(query:string){
  const compact=normalizeReference(query);
  return Boolean(compact&&compact.length>=4&&/\d/.test(compact)&&!query.trim().includes(" "));
}

function relevantToQuery(offer:SupplierOffer,query:string){
  const compact=normalizeReference(query)??"";
  if(queryLooksLikeReference(query)){
    const manufacturerRef=normalizeReference(offer.manufacturerReference)??"";
    const supplierRef=normalizeReference(offer.supplierSku)??"";
    return Boolean((manufacturerRef&&manufacturerRef.includes(compact))||(supplierRef&&supplierRef.includes(compact)));
  }
  const tokens=normalizeName(query).split(" ").filter(t=>t.length>=2);
  const hay=normalizeName([offer.rawName,offer.normalizedName,offer.manufacturer,offer.manufacturerReference,offer.supplierSku].filter(Boolean).join(" "));
  const matched=tokens.filter(t=>hay.includes(t));
  return matched.length>=Math.max(1,Math.ceil(tokens.length*0.6));
}

function safeId(value:string){
  return normalizeName(value).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80)||crypto.randomUUID();
}

function groupDynamicOffers(offers:SupplierOffer[]):DynamicGroup[]{
  const map=new Map<string,SupplierOffer[]>();
  for(const offer of offers){
    const ref=normalizeReference(offer.manufacturerReference);
    const fallback=normalizeName(offer.rawName).replace(/\b(?:oferta|promo|promocion)\b/g,"").trim().slice(0,100);
    const key=ref?"ref:"+ref:"name:"+fallback;
    const group=map.get(key)??[]; group.push(offer); map.set(key,group);
  }
  return [...map.entries()].map(([key,group])=>{
    const representative=group.find(o=>o.manufacturerReference)??group[0]!;
    const product:CanonicalProduct={
      id:"live-"+safeId(key),
      productName:representative.rawName,
      category:"Búsqueda live",
      manufacturer:representative.manufacturer??"Desconocido",
      manufacturerReference:representative.manufacturerReference,
      family:representative.rawName,
      normalizedName:representative.normalizedName||normalizeName(representative.rawName),
      presentation:representative.presentation??"No confirmada",
      quantity:representative.quantity??1,
      unit:representative.unit??"ud",
      packCount:representative.packCount??1,
      variant:representative.variant,
      shade:representative.shade,
      active:true
    };
    return {id:product.id,label:representative.rawName,manufacturerReference:representative.manufacturerReference,product,offers:group};
  }).sort((a,b)=>{
    const suppliersA=new Set(a.offers.map(o=>o.supplierId)).size;
    const suppliersB=new Set(b.offers.map(o=>o.supplierId)).size;
    return suppliersB-suppliersA||b.offers.length-a.offers.length;
  });
}

async function federatedSearch(query:string,sessionId:string){
  const fetchImpl=withTimeout(9000);
  const results=await Promise.all(suppliers.map(async supplierId=>{
    const discovered=await discoverSupplierProductUrls(supplierId,query,fetchImpl,3);
    if(!discovered.urls.length) return {supplierId,offers:[] as SupplierOffer[],error:discovered.error??"Sin resultados"};
    const pages=await Promise.all(discovered.urls.map(async productUrl=>{
      try{return await fetchSupplierUrl(supplierId,productUrl,fetchImpl);}
      catch{return [] as SupplierOffer[];}
    }));
    const policy=policyList.find(p=>p.supplierId===supplierId);
    const offers=pages.flat()
      .filter(o=>relevantToQuery(o,query))
      .map(o=>applySupplierPolicy(o,policy))
      .map(o=>({...o,verificationKind:"live" as const,verificationSessionId:sessionId,verifiedAt:new Date().toISOString()}))
      .filter(o=>supplierOfferSchema.safeParse(o).success);
    return {supplierId,offers,error:offers.length?null:"Sin coincidencias verificables"};
  }));
  return {
    offers:results.flatMap(r=>r.offers),
    errors:results.filter(r=>r.error).map(r=>({supplierId:r.supplierId,message:r.error!}))
  };
}

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const origin=request.headers.get("origin");
    const headers=cors(origin,env);
    if(!headers) return Response.json({error:"ORIGIN_NOT_ALLOWED"},{status:403});
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers});
    if(request.method!=="GET") return Response.json({error:"METHOD_NOT_ALLOWED"},{status:405,headers});

    const url=new URL(request.url);
    if(url.pathname==="/health") return Response.json({ok:true,at:new Date().toISOString(),suppliers,searchMode:"federated-live"},{headers});

    if(url.pathname==="/search-live"){
      const query=(url.searchParams.get("q")??"").trim();
      if(query.length<2) return Response.json({error:"QUERY_TOO_SHORT"},{status:400,headers});
      const requestedAt=new Date().toISOString(),sessionId=crypto.randomUUID();
      const result=await federatedSearch(query,sessionId);
      return Response.json({
        query,sessionId,requestedAt,completedAt:new Date().toISOString(),
        groups:groupDynamicOffers(result.offers),errors:result.errors
      },{headers});
    }

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