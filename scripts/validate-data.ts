import { readFile } from "node:fs/promises";
import { canonicalProductSchema, supplierOfferSchema } from "../src/domain/schemas";
import { matchOfferToProduct } from "../src/domain/matching/matcher";

async function json(path:string){ return JSON.parse(await readFile(path,"utf8")); }

const products=await json("data/products.json");
if(!Array.isArray(products)) throw new Error("data/products.json must be an array");
for(const [i,p] of products.entries()){
  const result=canonicalProductSchema.safeParse(p);
  if(!result.success) throw new Error(`Invalid product at index ${i}: ${result.error.message}`);
}

const ids=new Set<string>();
for(const p of products){
  if(ids.has(p.id)) throw new Error(`Duplicate product id: ${p.id}`);
  ids.add(p.id);
}

const ground=await json("fixtures/validation/ground-truth.json");
if(!Array.isArray(ground.cases) || ground.cases.length<30) throw new Error("Ground truth requires at least 30 cases");
let falseExact=0,wrong=0;
for(const c of ground.cases){
  canonicalProductSchema.parse(c.canonical);
  supplierOfferSchema.parse(c.candidate);
  const actual=matchOfferToProduct(c.canonical,c.candidate).status;
  if(actual!==c.expected){
    wrong++;
    if(actual==="EXACT" && c.expected!=="EXACT") falseExact++;
    console.error(`Ground truth mismatch ${c.id}: expected ${c.expected}, got ${actual}`);
  }
}
if(falseExact>0) throw new Error(`False-positive EXACT matches: ${falseExact}`);
if(wrong>0) throw new Error(`Ground truth mismatches: ${wrong}`);

try{
  const current=await json("data/current-prices.json");
  if(current?.entries){
    for(const e of current.entries) supplierOfferSchema.parse(e.offer);
  }
}catch(error){
  if((error as NodeJS.ErrnoException).code!=="ENOENT") throw error;
}

console.log(`Validated ${products.length} products and ${ground.cases.length} ground-truth cases; false EXACT = 0`);