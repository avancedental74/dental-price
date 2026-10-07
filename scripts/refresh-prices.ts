import { readFile, writeFile } from "node:fs/promises";
import type { CanonicalProduct, SupplierOffer } from "../src/types/domain";
import type { PriceObservation } from "../src/domain/history";
import { fetchDentaltixProduct } from "../src/connectors/dentaltix";
import { fetchProclinicProduct } from "../src/connectors/proclinic";
import { fetchDentalIbericaProduct } from "../src/connectors/dental-iberica";
import { fetchDentalCostProduct } from "../src/connectors/dentalcost";
import { fetchDvdProduct } from "../src/connectors/dvd-dental";
import { normalizeReference } from "../src/domain/matching/normalization";
import { analyzeOfferAnomaly } from "../src/domain/anomaly";
import { matchOfferToProduct } from "../src/domain/matching/matcher";
import { calculatePricing } from "../src/domain/pricing";
import { appendObservation } from "../src/domain/history";
import { supplierOfferSchema } from "../src/domain/schemas";

type Seed={productId:string;supplierId:string;url:string;acquisitionMode?:"direct"|"manual_verification"};
type ConnectorStatus={supplierId:string;productId?:string;status:"green"|"amber"|"red";checkedAt:string;message:string};
const readJson=async <T>(p:string):Promise<T>=>JSON.parse(await readFile(p,"utf8")) as T;
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const timedFetch:typeof fetch=async(input,init={})=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{return await fetch(input,{...init,signal:controller.signal});}
  finally{clearTimeout(timer);}
};

const products=await readJson<CanonicalProduct[]>("data/products.json");
const seeds=await readJson<Seed[]>("data/supplier-seeds.json");
let current=await readJson<SupplierOffer[]>("data/current-prices.json").catch(()=>[]);
let history=await readJson<PriceObservation[]>("data/price-history.json").catch(()=>[]);
const productMap=new Map(products.map(p=>[p.id,p]));
const statuses:ConnectorStatus[]=[];

async function fetchPage(seed:Seed):Promise<SupplierOffer[]>{
  if(seed.supplierId==="dentaltix") return (await fetchDentaltixProduct(seed.url,timedFetch)).offers;
  if(seed.supplierId==="proclinic") return (await fetchProclinicProduct(seed.url,timedFetch)).offers;
  if(seed.supplierId==="dental-iberica") return (await fetchDentalIbericaProduct(seed.url,timedFetch)).offers;
  if(seed.supplierId==="dentalcost") return (await fetchDentalCostProduct(seed.url,timedFetch)).offers;
  if(seed.supplierId==="dvd-dental") return (await fetchDvdProduct(seed.url,timedFetch)).offers;
  throw new Error("Unsupported supplier "+seed.supplierId);
}

const directSeeds=seeds.filter(s=>s.acquisitionMode!=="manual_verification");
const uniquePages=[...new Map(directSeeds.map(s=>[s.supplierId+"|"+s.url,s])).entries()];
const pageResults=new Map<string,SupplierOffer[]>();
const pageErrors=new Map<string,string>();

for(const [key,seed] of uniquePages){
  try{
    const offers=await fetchPage(seed);
    pageResults.set(key,offers);
  }catch(error){
    pageErrors.set(key,error instanceof Error?error.message:"Unknown error");
  }
  await sleep(1200);
}

for(const seed of seeds){
  const product=productMap.get(seed.productId);
  if(!product) continue;
  const checkedAt=new Date().toISOString();
  if(seed.acquisitionMode==="manual_verification"){
    statuses.push({supplierId:seed.supplierId,productId:seed.productId,status:"amber",checkedAt,message:seed.supplierId==="dvd-dental"?"Variant-specific automatic data is not reliably exposed; manual verification is required":"Automatic public access is unavailable; manual verification is required"});
    continue;
  }
  const key=seed.supplierId+"|"+seed.url;
  const pageError=pageErrors.get(key);
  if(pageError){
    statuses.push({supplierId:seed.supplierId,productId:seed.productId,status:pageError.includes("HTTP 405")?"amber":"red",checkedAt,message:pageError.includes("HTTP 405")?"Automatic public access unavailable (HTTP 405)":pageError});
    continue;
  }

  const targetRef=normalizeReference(product.manufacturerReference);
  const candidates=(pageResults.get(key)??[]).filter(offer=>targetRef && normalizeReference(offer.manufacturerReference)===targetRef);
  if(!candidates.length){
    statuses.push({supplierId:seed.supplierId,productId:seed.productId,status:"amber",checkedAt,message:"Manufacturer reference not found on parsed page"});
    continue;
  }

  const ranked=candidates.map(offer=>({offer,match:matchOfferToProduct(product,offer)})).sort((a,b)=>b.match.score-a.match.score);
  const best=ranked[0];
  const prior=[...history].reverse().find(h=>h.productId===product.id&&h.supplierId===best.offer.supplierId&&(h.supplierSku??"")===(best.offer.supplierSku??""));
  const anomaly=analyzeOfferAnomaly({offer:best.offer,previous:prior});
  const offer:SupplierOffer={...best.offer,sourceStatus:anomaly.severity};
  supplierOfferSchema.parse(offer);

  current=current.filter(existing=>!(existing.supplierId===offer.supplierId && normalizeReference(existing.manufacturerReference)===normalizeReference(offer.manufacturerReference)));
  current.push(offer);

  let unitCost:number|undefined;
  let totalCost:number|undefined;
  try{
    const pricing=calculatePricing(offer,{requestedQuantity:1,includeVat:true});
    const incomplete=pricing.warnings.some(w=>w==="IVA no confirmado"||w==="IVA excluido pero tasa desconocida"||w==="Transporte no confirmado");
    if(!incomplete){ unitCost=pricing.effectiveUnitCost; totalCost=pricing.effectiveTotalCost; }
  }catch(error){
    statuses.push({supplierId:seed.supplierId,productId:seed.productId,status:"amber",checkedAt,message:error instanceof Error?error.message:"Pricing error"});
  }
  history=appendObservation(history,product.id,offer,unitCost,totalCost,1).history;
  statuses.push({supplierId:seed.supplierId,productId:seed.productId,status:best.match.status==="EXACT"&&anomaly.severity==="normal"?"green":"amber",checkedAt,message:best.match.status+"; anomaly "+anomaly.severity});
}

current.sort((a,b)=>a.supplierId.localeCompare(b.supplierId)||(a.manufacturerReference??"").localeCompare(b.manufacturerReference??""));
await writeFile("data/current-prices.json",JSON.stringify(current,null,2)+"\n");
await writeFile("data/price-history.json",JSON.stringify(history,null,2)+"\n");
await writeFile("data/connector-status.json",JSON.stringify(statuses,null,2)+"\n");
console.log(JSON.stringify({offers:current.length,history:history.length,statuses:statuses.length,pageErrors:[...pageErrors.entries()]},null,2));