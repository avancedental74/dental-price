import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import type { CanonicalProduct, SupplierOffer } from "../src/types/domain";
import type { PriceObservation } from "../src/domain/history";
import { fetchDentaltixProduct } from "../src/connectors/dentaltix";
import { fetchProclinicProduct } from "../src/connectors/proclinic";
import { fetchDentalIbericaProduct } from "../src/connectors/dental-iberica";
import { matchOfferToProduct } from "../src/domain/matching/matcher";
import { applyAnomalyStatus } from "../src/domain/anomaly";
import { calculatePricing } from "../src/domain/pricing";
import { appendObservation } from "../src/domain/history";
import { supplierOfferSchema } from "../src/domain/schemas";

type Seed={productId:string;supplierId:string;url:string};
type PriceEntry={productId:string;offer:SupplierOffer;matchStatus:string;matchScore:number;collectionMode?:"automatic"|"manual_verified"|"last_known"};

async function json<T>(path:string):Promise<T>{ return JSON.parse(await readFile(path,"utf8")) as T; }
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

const products=await json<CanonicalProduct[]>("data/products.json");
const seeds=await json<Seed[]>("data/supplier-seeds.json");
let history=await json<PriceObservation[]>("data/price-history.json");
let previousCurrent:{generatedAt:string|null;entries:PriceEntry[]}={generatedAt:null,entries:[]};
try{ previousCurrent=await json("data/current-prices.json"); }catch{}
const productMap=new Map(products.map(p=>[p.id,p]));

const uniquePages=[...new Map(seeds.map(s=>[s.supplierId+"|"+s.url,s])).values()];
const pageResults=new Map<string,SupplierOffer[]>();
const status:Record<string,{status:"green"|"amber"|"red";checkedAt:string;message:string}>={};

async function fetchPage(seed:Seed):Promise<SupplierOffer[]>{
  if(seed.supplierId==="dentaltix") return (await fetchDentaltixProduct(seed.url)).offers;
  if(seed.supplierId==="proclinic") return (await fetchProclinicProduct(seed.url)).offers;
  if(seed.supplierId==="dental-iberica") return (await fetchDentalIbericaProduct(seed.url)).offers;
  throw new Error("Unknown supplier "+seed.supplierId);
}

for(const page of uniquePages){
  const key=page.supplierId+"|"+page.url;
  const checkedAt=new Date().toISOString();
  try{
    const offers=await fetchPage(page);
    pageResults.set(key,offers);
    status[page.supplierId]={status:offers.length?"green":"amber",checkedAt,message:offers.length+" offer(s) parsed"};
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown error";
    failedPageKeys.add(key);
    status[page.supplierId]={status:message.includes("HTTP 405")?"amber":"red",checkedAt,message:message.includes("HTTP 405")?"Automated access unavailable (HTTP 405); retaining last verified snapshot":message};
  }
  await sleep(1200);
}

const entries:PriceEntry[]=[];
const failedPageKeys=new Set<string>();
for(const seed of seeds){
  const product=productMap.get(seed.productId);
  if(!product) continue;
  const offers=pageResults.get(seed.supplierId+"|"+seed.url) ?? [];
  const ranked=offers.map(offer=>({offer,match:matchOfferToProduct(product,offer)}))
    .filter(x=>x.match.status!=="REJECTED")
    .sort((a,b)=>{
      const rank=(s:string)=>s==="EXACT"?3:s==="HIGH_CONFIDENCE"?2:s==="REVIEW_REQUIRED"?1:0;
      return rank(b.match.status)-rank(a.match.status) || b.match.score-a.match.score;
    });
  const best=ranked[0];
  if(!best) continue;

  const previous=[...history].reverse().find(h=>
    h.productId===product.id && h.supplierId===best.offer.supplierId &&
    (!best.offer.supplierSku || h.supplierSku===best.offer.supplierSku)
  );
  const offer=applyAnomalyStatus(best.offer,previous);
  supplierOfferSchema.parse(offer);
  entries.push({productId:product.id,offer,matchStatus:best.match.status,matchScore:best.match.score,collectionMode:"automatic"});

  let effectiveUnitCost: number|undefined;
  let effectiveTotalCost: number|undefined;
  try{
    const pricing=calculatePricing(offer,{requestedQuantity:1,includeVat:true});
    const incomplete=pricing.warnings.some(w=>w==="IVA no confirmado" || w==="IVA excluido pero tasa desconocida" || w==="Transporte no confirmado");
    if(!incomplete){ effectiveUnitCost=pricing.effectiveUnitCost; effectiveTotalCost=pricing.effectiveTotalCost; }
  }catch{}
  history=appendObservation(history,product.id,offer,effectiveUnitCost,effectiveTotalCost,1).history;
}

for(const seed of seeds){
  const pageKey=seed.supplierId+"|"+seed.url;
  if(!failedPageKeys.has(pageKey)) continue;
  const old=previousCurrent.entries.find(e=>e.productId===seed.productId && e.offer.supplierId===seed.supplierId);
  if(old && !entries.some(e=>e.productId===old.productId && e.offer.supplierId===old.offer.supplierId)) entries.push({...old,collectionMode:"last_known"});
}

const generatedAt=new Date().toISOString();
await writeFile("data/current-prices.json",JSON.stringify({generatedAt,entries},null,2)+"\n");
await writeFile("data/price-history.json",JSON.stringify(history,null,2)+"\n");
await writeFile("data/connector-status.json",JSON.stringify({generatedAt,suppliers:status},null,2)+"\n");
await mkdir("public/data",{recursive:true});
for(const file of ["products.json","current-prices.json","price-history.json","connector-status.json"]){
  await copyFile("data/"+file,"public/data/"+file);
}
console.log(`Refreshed ${entries.length} product/supplier entries from ${uniquePages.length} public pages`);