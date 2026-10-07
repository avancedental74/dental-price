import { readFile, writeFile } from "node:fs/promises";
import type { CanonicalProduct, SupplierOffer } from "../src/types/domain";
import type { PriceObservation } from "../src/domain/history";
import type { SupplierPolicy } from "../src/domain/supplier-policies";
import { applySupplierPolicy } from "../src/domain/supplier-policies";
import { fetchDentaltixProduct } from "../src/connectors/dentaltix";
import { fetchProclinicProduct } from "../src/connectors/proclinic";
import { fetchDentalIbericaProduct } from "../src/connectors/dental-iberica";
import { fetchDentalCostProduct } from "../src/connectors/dentalcost";
import { fetchDvdProduct } from "../src/connectors/dvd-dental";
import { fetchDentalExpressProduct } from "../src/connectors/dentalexpress";
import { fetchBrokerDentalProduct } from "../src/connectors/brokerdental";
import { fetchOrtolanProduct } from "../src/connectors/ortolan";
import { normalizeReference } from "../src/domain/matching/normalization";
import { analyzeOfferAnomaly } from "../src/domain/anomaly";
import { matchOfferToProduct } from "../src/domain/matching/matcher";
import { calculatePricing } from "../src/domain/pricing";
import { appendObservation } from "../src/domain/history";
import { supplierOfferSchema } from "../src/domain/schemas";

type Seed={productId:string;supplierId:string;url:string;acquisitionMode?:"direct"|"manual_verification"};
type ConnectorStatus={
  supplierId:string;productId?:string;status:"green"|"amber"|"red";checkedAt:string;message:string;
  verificationStatus:"verified"|"failed"|"manual_required";
  matchStatus?:"EXACT"|"HIGH_CONFIDENCE"|"REVIEW_REQUIRED"|"REJECTED";
  purchasable:boolean;
};
type Metrics={
  generatedAt:string;
  verifiedOffers:number;
  purchasableOffers:number;
  unavailableOffers:number;
  lowStockOffers:number;
  productsWithTwoOrMoreVerifiedSuppliers:number;
  productsWithTwoOrMorePurchasableSuppliers:number;
  automaticSuppliers:number;
  supplierOfferCounts:Record<string,number>;
};

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
const policies=await readJson<SupplierPolicy[]>("data/supplier-policies.json");
let history=await readJson<PriceObservation[]>("data/price-history.json").catch(()=>[]);
const previousCurrent=await readJson<SupplierOffer[]>("data/current-prices.json").catch(()=>[]);
const current:SupplierOffer[]=[];
const productMap=new Map(products.map(p=>[p.id,p]));
const policyMap=new Map(policies.map(p=>[p.supplierId,p]));
const statuses:ConnectorStatus[]=[];

async function fetchPage(seed:Seed):Promise<SupplierOffer[]>{
  if(seed.supplierId==="dentaltix") return (await fetchDentaltixProduct(seed.url,timedFetch)).offers;
  if(seed.supplierId==="proclinic") return (await fetchProclinicProduct(seed.url,timedFetch)).offers;
  if(seed.supplierId==="dental-iberica") return (await fetchDentalIbericaProduct(seed.url,timedFetch)).offers;
  if(seed.supplierId==="dentalcost") return (await fetchDentalCostProduct(seed.url,timedFetch)).offers;
  if(seed.supplierId==="dvd-dental") return (await fetchDvdProduct(seed.url,timedFetch)).offers;
  if(seed.supplierId==="dentalexpress") return (await fetchDentalExpressProduct(seed.url,timedFetch)).offers;
  if(seed.supplierId==="brokerdental") return (await fetchBrokerDentalProduct(seed.url,timedFetch)).offers;
  if(seed.supplierId==="ortolan") return (await fetchOrtolanProduct(seed.url,timedFetch)).offers;
  throw new Error("Unsupported supplier "+seed.supplierId);
}

const directSeeds=seeds.filter(s=>s.acquisitionMode!=="manual_verification");
const uniquePages=[...new Map(directSeeds.map(s=>[s.supplierId+"|"+s.url,s])).entries()];
const pageResults=new Map<string,SupplierOffer[]>();
const pageErrors=new Map<string,string>();

for(const [key,seed] of uniquePages){
  try{pageResults.set(key,await fetchPage(seed));}
  catch(error){pageErrors.set(key,error instanceof Error?error.message:"Unknown error");}
  await sleep(1200);
}

for(const seed of seeds){
  const product=productMap.get(seed.productId);
  if(!product) continue;
  const checkedAt=new Date().toISOString();

  if(seed.acquisitionMode==="manual_verification"){
    statuses.push({
      supplierId:seed.supplierId,productId:seed.productId,status:"amber",checkedAt,
      message:seed.supplierId==="dvd-dental"?"Variant-specific automatic data is not reliably exposed; manual verification is required":"Automatic public access is unavailable; manual verification is required",
      verificationStatus:"manual_required",purchasable:false
    });
    continue;
  }

  const key=seed.supplierId+"|"+seed.url;
  const pageError=pageErrors.get(key);
  if(pageError){
    statuses.push({
      supplierId:seed.supplierId,productId:seed.productId,status:pageError.includes("HTTP 405")?"amber":"red",checkedAt,
      message:pageError.includes("HTTP 405")?"Automatic public access unavailable (HTTP 405)":pageError,
      verificationStatus:"failed",purchasable:false
    });
    continue;
  }

  const targetRef=normalizeReference(product.manufacturerReference);
  const candidates=(pageResults.get(key)??[]).filter(offer=>targetRef&&normalizeReference(offer.manufacturerReference)===targetRef);
  if(!candidates.length){
    statuses.push({supplierId:seed.supplierId,productId:seed.productId,status:"amber",checkedAt,message:"Manufacturer reference not found on parsed page",verificationStatus:"failed",purchasable:false});
    continue;
  }

  const ranked=candidates.map(rawOffer=>{
    const offer=applySupplierPolicy(rawOffer,policyMap.get(rawOffer.supplierId));
    return {offer,match:matchOfferToProduct(product,offer)};
  }).sort((a,b)=>b.match.score-a.match.score);
  const best=ranked[0];

  if(best.match.status!=="EXACT"){
    statuses.push({supplierId:seed.supplierId,productId:seed.productId,status:"amber",checkedAt,message:"Offer found but matching is "+best.match.status,verificationStatus:"failed",matchStatus:best.match.status,purchasable:false});
    continue;
  }

  const prior=[...history].reverse().find(h=>h.productId===product.id&&h.supplierId===best.offer.supplierId&&(h.supplierSku??"")===(best.offer.supplierSku??""))
    ?? [...previousCurrent].reverse().find(o=>o.supplierId===best.offer.supplierId&&normalizeReference(o.manufacturerReference)===targetRef);
  const anomaly=analyzeOfferAnomaly({offer:best.offer,previous:prior&&"productId" in prior?prior:undefined});
  const offer:SupplierOffer={...best.offer,sourceStatus:anomaly.severity};
  supplierOfferSchema.parse(offer);
  current.push(offer);

  let unitCost:number|undefined,totalCost:number|undefined,pricingComplete=false;
  try{
    const pricing=calculatePricing(offer,{requestedQuantity:1,includeVat:true});
    pricingComplete=!pricing.warnings.some(w=>w==="IVA no confirmado"||w==="IVA excluido pero tasa desconocida"||w==="Transporte no confirmado");
    if(pricingComplete){unitCost=pricing.effectiveUnitCost;totalCost=pricing.effectiveTotalCost;}
  }catch{/* non-purchasable */}
  const stockEligible=offer.stockStatus==="in_stock"||offer.stockStatus==="low_stock";
  const purchasable=anomaly.severity==="normal"&&pricingComplete&&stockEligible;

  history=appendObservation(history,product.id,offer,unitCost,totalCost,1).history;
  statuses.push({
    supplierId:seed.supplierId,productId:seed.productId,status:anomaly.severity==="normal"?"green":"amber",checkedAt,
    message:"EXACT; anomaly "+anomaly.severity+(purchasable?"; purchasable":"; not purchasable"),
    verificationStatus:"verified",matchStatus:"EXACT",purchasable
  });
}

current.sort((a,b)=>a.supplierId.localeCompare(b.supplierId)||(a.manufacturerReference??"").localeCompare(b.manufacturerReference??""));

const automaticSupplierIds=new Set(current.filter(o=>o.sourceMode==="automatic").map(o=>o.supplierId));
const verifiedSupplierMap=new Map<string,Set<string>>();
const purchasableSupplierMap=new Map<string,Set<string>>();
for(const status of statuses){
  if(status.verificationStatus!=="verified"||!status.productId) continue;
  const verified=verifiedSupplierMap.get(status.productId)??new Set<string>();
  verified.add(status.supplierId); verifiedSupplierMap.set(status.productId,verified);
  if(status.purchasable){
    const purchasable=purchasableSupplierMap.get(status.productId)??new Set<string>();
    purchasable.add(status.supplierId); purchasableSupplierMap.set(status.productId,purchasable);
  }
}
const metrics:Metrics={
  generatedAt:new Date().toISOString(),
  verifiedOffers:current.length,
  purchasableOffers:statuses.filter(s=>s.verificationStatus==="verified"&&s.purchasable).length,
  unavailableOffers:current.filter(o=>o.stockStatus==="unavailable").length,
  lowStockOffers:current.filter(o=>o.stockStatus==="low_stock").length,
  productsWithTwoOrMoreVerifiedSuppliers:[...verifiedSupplierMap.values()].filter(s=>s.size>=2).length,
  productsWithTwoOrMorePurchasableSuppliers:[...purchasableSupplierMap.values()].filter(s=>s.size>=2).length,
  automaticSuppliers:automaticSupplierIds.size,
  supplierOfferCounts:current.reduce<Record<string,number>>((acc,o)=>(acc[o.supplierId]=(acc[o.supplierId]??0)+1,acc),{})
};

await writeFile("data/current-prices.json",JSON.stringify(current,null,2)+"\n");
await writeFile("data/price-history.json",JSON.stringify(history,null,2)+"\n");
await writeFile("data/connector-status.json",JSON.stringify(statuses,null,2)+"\n");
await writeFile("data/metrics.json",JSON.stringify(metrics,null,2)+"\n");
console.log(JSON.stringify({offers:current.length,history:history.length,statuses:statuses.length,metrics,pageErrors:[...pageErrors.entries()]},null,2));