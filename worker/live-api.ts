import policies from "../data/supplier-policies.json";
import priceHistory from "../data/price-history.json";
import type { SupplierOffer } from "../src/types/domain";
import type { SupplierPolicy } from "../src/domain/supplier-policies";
import { applySupplierPolicy } from "../src/domain/supplier-policies";
import { supplierOfferSchema } from "../src/domain/schemas";
import { fetchDentaltixProduct } from "../src/connectors/dentaltix";
import { fetchDentalCostProduct } from "../src/connectors/dentalcost";
import { fetchDvdProduct } from "../src/connectors/dvd-dental";
import { fetchDentalExpressProduct } from "../src/connectors/dentalexpress";
import { fetchOrtolanProduct } from "../src/connectors/ortolan";
import { fetchDentipakProduct } from "../src/connectors/dentipak";
import { fetchDentalBoomProduct } from "../src/connectors/dentalboom";
import { discoverSupplierProductUrls, searchDvdKlevuRecords, searchOrtolanRecords, searchDentalBoomRecords } from "../src/connectors/live-search";
import { allSearchSupplierIds, browserProtectedSupplierIds, liveAutomaticSupplierIds, type SearchSupplierId } from "../src/connectors/live-supplier-registry";
import { normalizeName, normalizeReference } from "../src/domain/matching/normalization";
import { applyAnomalyStatus } from "../src/domain/anomaly";
import type { PriceObservation } from "../src/domain/history";

type Env={ALLOWED_ORIGIN?:string};
const policyList=policies as SupplierPolicy[];
const automaticSuppliers:readonly SearchSupplierId[]=liveAutomaticSupplierIds;
const protectedSuppliers:readonly SearchSupplierId[]=browserProtectedSupplierIds;
const suppliers:readonly SearchSupplierId[]=allSearchSupplierIds;

function cors(origin:string|null,env:Env){
  const allowed=env.ALLOWED_ORIGIN??"*";
  if(allowed!=="*"&&origin&&origin!==allowed)return null;
  return {
    "access-control-allow-origin":allowed==="*"?"*":allowed,
    "access-control-allow-methods":"GET,OPTIONS",
    "access-control-allow-headers":"content-type",
    "cache-control":"no-store",
    "vary":"Origin"
  };
}

const history=priceHistory as PriceObservation[];

function observationTime(item:PriceObservation){
  const value=new Date(item.lastSeenAt??item.observedAt).getTime();
  return Number.isFinite(value)?value:0;
}

const latestHistoryBySku=new Map<string,PriceObservation>();
const latestHistoryByUrl=new Map<string,PriceObservation>();
for(const item of history){
  if(item.supplierSku){
    const ref=normalizeReference(item.supplierSku);
    if(ref){
      const key=item.supplierId+"|"+ref;
      const previous=latestHistoryBySku.get(key);
      if(!previous||observationTime(item)>observationTime(previous))latestHistoryBySku.set(key,item);
    }
  }
  if(item.sourceUrl){
    const key=item.supplierId+"|"+item.sourceUrl;
    const previous=latestHistoryByUrl.get(key);
    if(!previous||observationTime(item)>observationTime(previous))latestHistoryByUrl.set(key,item);
  }
}

function latestPreviousObservation(offer:SupplierOffer):PriceObservation|undefined{
  const sku=normalizeReference(offer.supplierSku);
  if(sku)return latestHistoryBySku.get(offer.supplierId+"|"+sku);
  return latestHistoryByUrl.get(offer.supplierId+"|"+offer.productUrl);
}

function applyLiveSafety(offer:SupplierOffer):SupplierOffer{
  return applyAnomalyStatus(offer,latestPreviousObservation(offer));
}

function withTimeout(ms=8500):typeof fetch{
  return async(input,init={})=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),ms);
    try{return await fetch(input,{...init,signal:controller.signal});}
    finally{clearTimeout(timer);}
  };
}

async function fetchSupplierUrl(supplierId:SearchSupplierId,productUrl:string,fetchImpl:typeof fetch):Promise<SupplierOffer[]>{
  if(supplierId==="dentaltix")return (await fetchDentaltixProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="dentalcost")return (await fetchDentalCostProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="dvd-dental")return (await fetchDvdProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="dentalexpress")return (await fetchDentalExpressProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="ortolan")return (await fetchOrtolanProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="dentipak")return (await fetchDentipakProduct(productUrl,fetchImpl)).offers;
  if(supplierId==="dentalboom")return (await fetchDentalBoomProduct(productUrl,fetchImpl)).offers;
  return [];
}

function looksLikeReference(query:string){
  const compact=normalizeReference(query)??"";
  return compact.length>=4&&/\d/.test(compact)&&!query.trim().includes(" ");
}

function relevantToQuery(offer:SupplierOffer,query:string){
  const compact=normalizeReference(query)??"";
  if(looksLikeReference(query)){
    const manufacturerRef=normalizeReference(offer.manufacturerReference)??"";
    const supplierRef=normalizeReference(offer.supplierSku)??"";
    return Boolean((manufacturerRef&&manufacturerRef.includes(compact))||(supplierRef&&supplierRef.includes(compact)));
  }
  const tokens=normalizeName(query).split(" ").filter(t=>t.length>=2);
  // Do not use normalizedName here: some connectors intentionally prefix the parent
  // product name to every variant, which would make unrelated cross-sell variants pass.
  const hay=normalizeName([offer.rawName,offer.manufacturer,offer.manufacturerReference,offer.supplierSku].filter(Boolean).join(" "));
  const matched=tokens.filter(t=>hay.includes(t));
  return matched.length>=Math.max(1,Math.ceil(tokens.length*0.6));
}

async function searchOneSupplier(supplierId:SearchSupplierId,query:string,sessionId:string){
  const fetchImpl=withTimeout();
  if(supplierId==="dentalboom"){
    const records=await searchDentalBoomRecords(query,fetchImpl,4);
    const pages:SupplierOffer[][]=[];
    for(const record of records.slice(0,2)){
      try{
        const pageOffers=(await fetchDentalBoomProduct(record.url,fetchImpl)).offers.filter(o=>relevantToQuery(o,query));
        if(pageOffers.length)pages.push(pageOffers);
      }catch{ /* try next API result */ }
    }
    const policy=policyList.find(p=>p.supplierId===supplierId);
    const offers=pages.flat()
      .map(o=>applyLiveSafety(applySupplierPolicy(o,policy)))
      .map(o=>({...o,verificationKind:"live" as const,verificationSessionId:sessionId,verifiedAt:new Date().toISOString()}))
      .filter(o=>supplierOfferSchema.safeParse(o).success);
    return {offers,error:null,noMatch:offers.length===0,discoveredFrom:"woocommerce-store-api+product"};
  }
  if(supplierId==="ortolan"){
    const records=await searchOrtolanRecords(query,fetchImpl,8);
    const policy=policyList.find(p=>p.supplierId===supplierId);
    const offers=records.map(record=>{
      const rawName=[record.name,record.variant].filter(Boolean).join(" - ");
      const shade=rawName.match(/\b(A\d(?:[.,]5)?|B\d(?:[.,]5)?|C\d(?:[.,]5)?|D\d(?:[.,]5)?)\b/i)?.[1]?.replace(",",".").toUpperCase();
      const variant=/\bdentina\b|\bdentin\b/i.test(rawName)?"Dentin":/\besmalte\b|\benamel\b/i.test(rawName)?"Enamel":undefined;
      const quantityMatch=rawName.match(/(\d+(?:[.,]\d+)?)\s*(g|grm?|ml)\b/i);
      const packMatch=rawName.match(/\b(\d+)\s*(?:cavifills?|c[aá]psulas?|capsules?)\b/i);
      const quantity=quantityMatch?Number(quantityMatch[1].replace(",",".")):undefined;
      const unit=quantityMatch?(quantityMatch[2].toLowerCase().startsWith("g")?"g":"ml"):undefined;
      const packCount=packMatch?Number(packMatch[1]):quantity?1:undefined;
      const offer:SupplierOffer={
        supplierId:"ortolan",
        supplierSku:record.supplierSku,
        rawName,
        normalizedName:normalizeName(rawName),
        productUrl:record.url??"https://ortolan.es/es/busqueda?controller=search&s="+encodeURIComponent(query),
        presentation:/jeringa/i.test(rawName)?"Jeringa":/cavifill|capsul|cápsul/i.test(rawName)?"Cápsulas":undefined,
        quantity,unit,packCount,variant,shade,
        stockStatus:typeof record.stockQuantity==="number"
          ?record.stockQuantity<=0?"unavailable":record.stockQuantity<=5?"low_stock":"in_stock"
          :"unknown",
        rawStockText:typeof record.stockQuantity==="number"?"Stock publicado: "+record.stockQuantity:undefined,
        regularPrice:record.price,
        salePrice:record.price,
        vatStatus:"unknown",
        currency:"EUR",
        observedAt:new Date().toISOString(),
        sourceStatus:"normal",
        sourceMode:"automatic"
      };
      return applyLiveSafety(applySupplierPolicy(offer,policy));
    })
      .filter(o=>relevantToQuery(o,query))
      .map(o=>({...o,verificationKind:"live" as const,verificationSessionId:sessionId,verifiedAt:new Date().toISOString()}))
      .filter(o=>supplierOfferSchema.safeParse(o).success);
    return {offers,error:null,noMatch:offers.length===0,discoveredFrom:"ortolan-structured-search"};
  }
  if(supplierId==="dvd-dental"){
    const records=await searchDvdKlevuRecords(query,fetchImpl,5);
    const compact=normalizeReference(query)??"";
    const policy=policyList.find(p=>p.supplierId===supplierId);

    if(looksLikeReference(query)){
      const exactRecords=records.filter(record=>normalizeReference(record["nº_pieza_fabricante"])===compact||normalizeReference(record.sku)===compact).slice(0,1);
      const pages=await Promise.all(exactRecords.map(async record=>{
        if(!record.url)return [] as SupplierOffer[];
        try{return (await fetchDvdProduct(record.url,fetchImpl)).offers;}
        catch{return [] as SupplierOffer[];}
      }));
      const offers=pages.flat()
        .filter(o=>relevantToQuery(o,query))
        .map(o=>applyLiveSafety(applySupplierPolicy(o,policy)))
        .map(o=>({...o,verificationKind:"live" as const,verificationSessionId:sessionId,verifiedAt:new Date().toISOString()}))
        .filter(o=>supplierOfferSchema.safeParse(o).success);
      return {offers,error:null,noMatch:offers.length===0,discoveredFrom:"klevu+product"};
    }

    const offers=records.map(record=>{
      const sale=Number(record.salePrice??record.price??record.basePrice);
      const regular=Number(record.basePrice??record.price??record.salePrice);
      const rawName=record.name??"Producto DVD Dental";
      const manufacturerReference=record["nº_pieza_fabricante"];
      const metric=rawName.match(/(?:x\s*)?(\d+(?:[.,]\d+)?)\s*(g|gr|ml)\b/i);
      const pack=rawName.match(/\b(\d+)\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:g|gr|ml)\b/i);
      const quantity=metric?Number(metric[1].replace(",",".")):undefined;
      const unit=metric?(metric[2].toLowerCase().startsWith("g")?"g":"ml"):undefined;
      const offer:SupplierOffer={
        supplierId:"dvd-dental",
        supplierSku:record.sku,
        manufacturer:record.brand,
        manufacturerReference,
        rawName,
        normalizedName:normalizeName([rawName,record.brand??"",manufacturerReference??"",record.sku??""].join(" ")),
        productUrl:record.url??"https://www.dvd-dental.com/",
        presentation:/jeringa|syringe/i.test(rawName)?"Jeringa":/cavifill|capsul|cápsul|caps\b/i.test(rawName)?"Cápsulas":undefined,
        quantity,unit,packCount:pack?Number(pack[1]):quantity?1:undefined,
        stockStatus:/^(?:yes|true|1)$/i.test(record.inStock??"")?"in_stock":"unknown",
        regularPrice:Number.isFinite(regular)&&regular>0?regular:Number.isFinite(sale)&&sale>0?sale:0,
        salePrice:Number.isFinite(sale)&&sale>0?sale:undefined,
        vatStatus:"unknown",
        currency:"EUR",
        observedAt:new Date().toISOString(),
        sourceStatus:"normal",
        sourceMode:"automatic"
      };
      return applyLiveSafety(applySupplierPolicy(offer,policy));
    })
      .filter(o=>o.regularPrice>0)
      .filter(o=>relevantToQuery(o,query))
      .map(o=>({...o,verificationKind:"live" as const,verificationSessionId:sessionId,verifiedAt:new Date().toISOString()}))
      .filter(o=>supplierOfferSchema.safeParse(o).success);
    return {offers,error:null,noMatch:offers.length===0,discoveredFrom:"klevu"};
  }
  const candidateLimit=supplierId==="dentaltix"?1:supplierId==="dentalcost"?3:supplierId==="dentipak"?2:3;
  const discovered=await discoverSupplierProductUrls(supplierId,query,fetchImpl,candidateLimit);
  if(!discovered.urls.length){
    const message=discovered.error??"Sin resultados";
    const noMatch=/^Sin\b/i.test(message);
    return {offers:[] as SupplierOffer[],error:noMatch?null:message,noMatch,discoveredFrom:discovered.searchUrl};
  }
  const policy=policyList.find(p=>p.supplierId===supplierId);
  const verified:SupplierOffer[]=[];
  if(supplierId==="dentalcost"){
    for(const productUrl of discovered.urls){
      try{
        const pageOffers=await fetchSupplierUrl(supplierId,productUrl,fetchImpl);
        const relevant=pageOffers.filter(o=>relevantToQuery(o,query));
        if(relevant.length){
          verified.push(...relevant);
          break;
        }
      }catch{ /* try next candidate */ }
    }
  }else{
    const pages=await Promise.all(discovered.urls.map(async productUrl=>{
      try{return await fetchSupplierUrl(supplierId,productUrl,fetchImpl);}
      catch{return [] as SupplierOffer[];}
    }));
    verified.push(...pages.flat().filter(o=>relevantToQuery(o,query)));
  }
  const offers=verified
    .map(o=>applyLiveSafety(applySupplierPolicy(o,policy)))
    .map(o=>({...o,verificationKind:"live" as const,verificationSessionId:sessionId,verifiedAt:new Date().toISOString()}))
    .filter(o=>supplierOfferSchema.safeParse(o).success);
  return {offers,error:null,noMatch:offers.length===0,discoveredFrom:discovered.searchUrl};
}

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const origin=request.headers.get("origin");
    const headers=cors(origin,env);
    if(!headers)return Response.json({error:"ORIGIN_NOT_ALLOWED"},{status:403});
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
    if(request.method!=="GET")return Response.json({error:"METHOD_NOT_ALLOWED"},{status:405,headers});

    const url=new URL(request.url);
    if(url.pathname==="/health")return Response.json({ok:true,at:new Date().toISOString(),suppliers:automaticSuppliers,protectedSuppliers,searchMode:"dynamic-per-supplier"},{headers});

    if(url.pathname==="/search-supplier"){
      const query=(url.searchParams.get("q")??"").trim();
      const supplierId=(url.searchParams.get("supplier")??"") as SearchSupplierId;
      const requestedAt=new Date().toISOString();
      const sessionId=(url.searchParams.get("sessionId")??"").trim()||crypto.randomUUID();
      if(query.length<2)return Response.json({error:"QUERY_TOO_SHORT"},{status:400,headers});
      if(!suppliers.includes(supplierId))return Response.json({error:"UNKNOWN_SUPPLIER"},{status:400,headers});
      if(protectedSuppliers.includes(supplierId))return Response.json({
        query,supplierId,sessionId,requestedAt,completedAt:new Date().toISOString(),offers:[],
        error:"BROWSER_VERIFICATION_REQUIRED",noMatch:false
      },{status:409,headers});
      try{
        const result=await searchOneSupplier(supplierId,query,sessionId);
        return Response.json({query,supplierId,sessionId,requestedAt,completedAt:new Date().toISOString(),offers:result.offers,error:result.error??null,noMatch:result.noMatch??false,discoveredFrom:result.discoveredFrom},{headers});
      }catch(error){
        return Response.json({query,supplierId,sessionId,requestedAt,completedAt:new Date().toISOString(),offers:[],error:error instanceof Error?error.message:"SEARCH_ERROR"},{headers});
      }
    }

    if(url.pathname==="/live-prices"||url.pathname==="/search-live"){
      return Response.json({error:"DEPRECATED_USE_SEARCH_SUPPLIER"},{status:410,headers});
    }

    return Response.json({error:"NOT_FOUND"},{status:404,headers});
  }
};