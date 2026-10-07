import { readFile } from "node:fs/promises";
import { z } from "zod";
import { canonicalProductSchema, supplierOfferSchema } from "../src/domain/schemas";

async function readJson(path:string){ return JSON.parse(await readFile(path,"utf8")); }

const historySchema=z.array(z.object({
  id:z.string(),productId:z.string(),supplierId:z.string(),observedAt:z.string(),lastSeenAt:z.string(),seenCount:z.number().int().positive(),requestedQuantity:z.number().int().positive(),regularPrice:z.number().nonnegative(),effectiveUnitCost:z.number().positive().optional(),effectiveTotalCost:z.number().positive().optional(),stockStatus:z.string(),sourceUrl:z.string().url()
}).passthrough());
const statusSchema=z.array(z.object({supplierId:z.string(),status:z.enum(["green","amber","red"]),checkedAt:z.string(),message:z.string()}).passthrough());

const products=z.array(canonicalProductSchema).parse(await readJson("data/products.json"));
const currentRaw=await readJson("data/current-prices.json");
const current=z.array(supplierOfferSchema).parse(currentRaw);
const history=historySchema.parse(await readJson("data/price-history.json"));
const status=statusSchema.parse(await readJson("data/connector-status.json"));
const gt=await readJson("fixtures/validation/ground-truth.json");
if(!Array.isArray(gt.cases)||gt.cases.length<30) throw new Error("Ground truth must contain at least 30 cases");
console.log(JSON.stringify({products:products.length,currentOffers:current.length,history:history.length,connectors:status.length,groundTruth:gt.cases.length},null,2));