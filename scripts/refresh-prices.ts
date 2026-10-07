import { readFile, writeFile } from "node:fs/promises";
import type { CanonicalProduct, SupplierOffer } from "../src/types/domain";
import type { PriceObservation } from "../src/domain/history";
import { fetchDentaltixProduct } from "../src/connectors/dentaltix";
import { fetchProclinicProduct } from "../src/connectors/proclinic";
import { fetchDentalIbericaProduct } from "../src/connectors/dental-iberica";
import { normalizeReference } from "../src/domain/matching/normalization";
import { analyzeOfferAnomaly } from "../src/domain/anomaly";
import { matchOfferToProduct } from "../src/domain/matching/matcher";
import { calculatePricing } from "../src/domain/pricing";
import { appendObservation } from "../src/domain/history";

type Seed={productId:string;supplierId:string;manufacturerReference:string;url:string};
const readJson=async <T>(p:string):Promise<T>=>JSON.parse(await readFile(p,"utf8"));
const products=await readJson<CanonicalProduct[]>("data/products.json");
const seeds=await readJson<Seed[]>("data/catalog-seeds.json");
let current=await readJson<SupplierOffer[]>("data/current-prices.json").catch(()=>[]);
let history=await readJson<PriceObservation[]>("data/price-history.json").catch(()=>[]);
const statuses:any[]=[];

async function fetchSeed(seed:Seed){
  if(seed.supplierId==="dentaltix") return (await fetchDentaltixProduct(seed.url)).offers;
  if(seed.supplierId==="proclinic") return (await fetchProclinicProduct(seed.url)).offers;
  if(seed.supplierId==="dental-iberica") return (await fetchDentalIbericaProduct(seed.url)).offers;
  throw new Error("Unsupported supplier "+seed.supplierId);
}

for(const seed of seeds){
  const product=products.find(p=>p.id===seed.productId);
  if(!product) continue;
  try{
    const offers=await fetchSeed(seed);
    const wantedRef=normalizeReference(seed.manufacturerReference);
    const candidates=offers.filter(o=>normalizeReference(o.manufacturerReference)===wantedRef);
    if(!candidates.length) throw new Error("Expected manufacturer reference not found: "+seed.manufacturerReference);
    for(const raw of candidates){
      const prior=[...history].reverse().find(h=>h.productId===product.id&&h.supplierId===raw.supplierId&&(h.supplierSku??"")===(raw.supplierSku??""));
      const anomaly=analyzeOfferAnomaly({offer:raw,previous:prior});
      const offer={...raw,sourceStatus:anomaly.severity};
      const match=matchOfferToProduct(product,offer);
      current=current.filter(x=>!(x.supplierId===offer.supplierId && (x.supplierSku??x.manufacturerReference)===(offer.supplierSku??offer.manufacturerReference)));
      current.push(offer);
      let unitCost:number|undefined,totalCost:number|undefined;
      try{
        const pricing=calculatePricing(offer,{requestedQuantity:1,includeVat:true});
        if(!pricing.warnings.some(w=>w.includes("no confirmado")||w.includes("desconocida"))){
          unitCost=pricing.effectiveUnitCost; totalCost=pricing.effectiveTotalCost;
        }
      }catch{}
      history=appendObservation(history,product.id,offer,unitCost,totalCost,1).history;
      statuses.push({supplierId:seed.supplierId,productId:seed.productId,status:match.status==="REJECTED"?"amber":"green",checkedAt:new Date().toISOString(),message:`${match.status}; ${anomaly.severity}`});
    }
  }catch(error){
    statuses.push({supplierId:seed.supplierId,productId:seed.productId,status:"red",checkedAt:new Date().toISOString(),message:error instanceof Error?error.message:"Unknown error"});
  }
}

await writeFile("data/current-prices.json",JSON.stringify(current,null,2)+"\n");
await writeFile("data/price-history.json",JSON.stringify(history,null,2)+"\n");
await writeFile("data/connector-status.json",JSON.stringify(statuses,null,2)+"\n");
console.log(JSON.stringify({offers:current.length,history:history.length,statuses},null,2));