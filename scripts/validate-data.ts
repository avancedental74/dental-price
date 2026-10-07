import { readFile } from "node:fs/promises";
import { z } from "zod";
import { canonicalProductSchema, supplierOfferSchema } from "../src/domain/schemas";
import { matchOfferToProduct } from "../src/domain/matching/matcher";

async function readJson(path:string){ return JSON.parse(await readFile(path,"utf8")); }

const historySchema=z.array(z.object({
  id:z.string(),productId:z.string(),supplierId:z.string(),observedAt:z.string(),lastSeenAt:z.string(),seenCount:z.number().int().positive(),requestedQuantity:z.number().int().positive(),regularPrice:z.number().nonnegative(),effectiveUnitCost:z.number().positive().optional(),effectiveTotalCost:z.number().positive().optional(),stockStatus:z.string(),sourceUrl:z.string().url()
}).passthrough());
const statusSchema=z.array(z.object({supplierId:z.string(),status:z.enum(["green","amber","red"]),checkedAt:z.string(),message:z.string()}).passthrough());
const seedSchema=z.array(z.object({productId:z.string(),supplierId:z.enum(["dentaltix","proclinic","dental-iberica"]),url:z.string().url()}));

const products=z.array(canonicalProductSchema).parse(await readJson("data/products.json"));
const current=z.array(supplierOfferSchema).parse(await readJson("data/current-prices.json"));
const history=historySchema.parse(await readJson("data/price-history.json"));
const status=statusSchema.parse(await readJson("data/connector-status.json"));
const seeds=seedSchema.parse(await readJson("data/supplier-seeds.json"));

const ids=new Set<string>();
for(const product of products){
  if(ids.has(product.id)) throw new Error("Duplicate product id: "+product.id);
  ids.add(product.id);
}
for(const seed of seeds){
  if(!ids.has(seed.productId)) throw new Error("Supplier seed references unknown product: "+seed.productId);
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
  products:products.length,currentOffers:current.length,history:history.length,connectors:status.length,seeds:seeds.length,groundTruth:gt.cases.length,falseExact
},null,2));