import { readFile } from "node:fs/promises";
import { z } from "zod";
import { canonicalProductSchema, supplierOfferSchema } from "../src/domain/schemas";
import { matchOfferToProduct } from "../src/domain/matching/matcher";

async function readJson(path:string){ return JSON.parse(await readFile(path,"utf8")); }

const historySchema=z.array(z.object({
  id:z.string(),productId:z.string(),supplierId:z.string(),observedAt:z.string(),lastSeenAt:z.string(),seenCount:z.number().int().positive(),requestedQuantity:z.number().int().positive(),regularPrice:z.number().nonnegative(),effectiveUnitCost:z.number().positive().optional(),effectiveTotalCost:z.number().positive().optional(),stockStatus:z.string(),sourceUrl:z.string().url()
}).passthrough());
const statusSchema=z.array(z.object({
  supplierId:z.string(),status:z.enum(["green","amber","red"]),checkedAt:z.string(),message:z.string(),
  verificationStatus:z.enum(["verified","failed","manual_required"]).optional(),
  matchStatus:z.enum(["EXACT","HIGH_CONFIDENCE","REVIEW_REQUIRED","REJECTED"]).optional(),
  purchasable:z.boolean().optional()
}).passthrough());
const policySchema=z.array(z.object({
  supplierId:z.string(),zone:z.literal("ES_PENINSULA"),shippingCost:z.number().nonnegative(),shippingCostVatIncluded:z.boolean(),shippingVatRate:z.number().nonnegative(),
  freeShippingThreshold:z.number().nonnegative(),freeShippingThresholdBasis:z.enum(["net","gross"]),observedAt:z.string(),sourceUrl:z.string().url()
}));
const metricsSchema=z.object({
  generatedAt:z.string(),verifiedOffers:z.number().int().nonnegative(),purchasableOffers:z.number().int().nonnegative(),
  unavailableOffers:z.number().int().nonnegative(),lowStockOffers:z.number().int().nonnegative(),
  productsWithTwoOrMoreVerifiedSuppliers:z.number().int().nonnegative(),productsWithTwoOrMorePurchasableSuppliers:z.number().int().nonnegative(),automaticSuppliers:z.number().int().nonnegative(),
  supplierOfferCounts:z.record(z.string(),z.number().int().nonnegative())
});
const seedSchema=z.array(z.object({productId:z.string(),supplierId:z.enum(["dentaltix","proclinic","dental-iberica","dentalcost","dvd-dental"]),url:z.string().url()}));

const products=z.array(canonicalProductSchema).parse(await readJson("data/products.json"));
const current=z.array(supplierOfferSchema).parse(await readJson("data/current-prices.json"));
const history=historySchema.parse(await readJson("data/price-history.json"));
const status=statusSchema.parse(await readJson("data/connector-status.json"));
const seeds=seedSchema.parse(await readJson("data/supplier-seeds.json"));
const policies=policySchema.parse(await readJson("data/supplier-policies.json"));
const metrics=metricsSchema.parse(await readJson("data/metrics.json").catch(()=>({
  generatedAt:new Date(0).toISOString(),verifiedOffers:current.length,purchasableOffers:0,unavailableOffers:0,lowStockOffers:0,productsWithTwoOrMoreVerifiedSuppliers:0,productsWithTwoOrMorePurchasableSuppliers:0,automaticSuppliers:0,supplierOfferCounts:{}
})));

const ids=new Set<string>();
for(const product of products){
  if(ids.has(product.id)) throw new Error("Duplicate product id: "+product.id);
  ids.add(product.id);
}
for(const seed of seeds){
  if(!ids.has(seed.productId)) throw new Error("Supplier seed references unknown product: "+seed.productId);
}


const productByRef=new Map(products.filter(p=>p.manufacturerReference).map(p=>[String(p.manufacturerReference).replace(/[^a-z0-9]/gi,"").toUpperCase(),p]));
const verifiedKeys=new Set(status.filter(s=>s.verificationStatus==="verified"&&s.productId).map(s=>s.supplierId+"|"+s.productId));
for(const offer of current){
  const ref=String(offer.manufacturerReference??"").replace(/[^a-z0-9]/gi,"").toUpperCase();
  const product=productByRef.get(ref);
  if(!product) throw new Error("Current offer has no canonical product: "+offer.supplierId+" "+String(offer.manufacturerReference));
  const key=offer.supplierId+"|"+product.id;
  if(!verifiedKeys.has(key)) throw new Error("Current offer lacks successful verification in this snapshot: "+key);
}
for(const s of status.filter(x=>x.verificationStatus==="verified"&&x.productId)){
  const product=products.find(p=>p.id===s.productId);
  const ref=String(product?.manufacturerReference??"").replace(/[^a-z0-9]/gi,"").toUpperCase();
  const exists=current.some(o=>o.supplierId===s.supplierId&&String(o.manufacturerReference??"").replace(/[^a-z0-9]/gi,"").toUpperCase()===ref);
  if(!exists) throw new Error("Verified status has no current offer: "+s.supplierId+"|"+s.productId);
}

const gt=await readJson("fixtures/validation/ground-truth.json");
if(!Array.isArray(gt.cases)||gt.cases.length<30) throw new Error("Ground truth must contain at least 30 cases");
let mismatches=0;
let falseExact=0;
for(const c of gt.cases){
  const canonical=canonicalProductSchema.parse({
    id:c.id,
    productName:c.canonical.family,
    category:"validation",
    normalizedName:String(c.canonical.family).toLowerCase(),
    active:true,
    ...c.canonical
  });
  const candidate=supplierOfferSchema.parse({
    rawName:c.offer.normalizedName,
    productUrl:"https://example.com/validation",
    stockStatus:"in_stock",
    regularPrice:1,
    vatStatus:"included",
    currency:"EUR",
    observedAt:"2026-10-07T08:00:00.000Z",
    sourceStatus:"normal",
    ...c.offer
  });
  const actual=matchOfferToProduct(canonical,candidate).status;
  if(actual!==c.expected){
    mismatches++;
    if(actual==="EXACT"&&c.expected!=="EXACT") falseExact++;
    console.error(`Ground truth mismatch ${c.id}: expected ${c.expected}; got ${actual}`);
  }
}
if(falseExact>0) throw new Error("Ground truth contains "+falseExact+" false-positive EXACT matches");
if(mismatches>0) throw new Error("Ground truth mismatches: "+mismatches);

console.log(JSON.stringify({
  products:products.length,currentOffers:current.length,history:history.length,connectors:status.length,seeds:seeds.length,policies:policies.length,metrics,groundTruth:gt.cases.length,falseExact
},null,2));