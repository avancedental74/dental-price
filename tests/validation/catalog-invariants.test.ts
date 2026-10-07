import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonicalProduct, SupplierOffer } from "../../src/types/domain";
import { matchOfferToProduct } from "../../src/domain/matching/matcher";

const here=dirname(fileURLToPath(import.meta.url));
const products=JSON.parse(readFileSync(resolve(here,"../../data/products.json"),"utf8")) as CanonicalProduct[];
function offerFrom(p:CanonicalProduct):SupplierOffer{return {supplierId:"fixture",manufacturer:p.manufacturer,manufacturerReference:p.manufacturerReference,eanGtin:p.eanGtin,rawName:p.normalizedName,normalizedName:p.normalizedName,productUrl:"https://example.com/"+p.id,presentation:p.presentation,quantity:p.quantity,unit:p.unit,packCount:p.packCount,variant:p.variant,shade:p.shade,stockStatus:"in_stock",regularPrice:1,vatStatus:"included",currency:"EUR",observedAt:new Date().toISOString(),sourceStatus:"normal"};}
describe("catalog-wide matching invariants",()=>{
 it("all reference-backed canonical products exact-match their own critical identity",()=>{
  for(const p of products.filter(x=>x.manufacturerReference)){expect(matchOfferToProduct(p,offerFrom(p)).status,p.id).toBe("EXACT");}
 });
 it("a contradictory manufacturer reference never exact-matches",()=>{
  for(const p of products.filter(x=>x.manufacturerReference)){const o={...offerFrom(p),manufacturerReference:"WRONG-"+p.manufacturerReference};expect(matchOfferToProduct(p,o).status,p.id).toBe("REJECTED");}
 });
 it("a contradictory presentation never exact-matches",()=>{
  for(const p of products.filter(x=>x.manufacturerReference)){const o={...offerFrom(p),presentation:p.presentation==="Jeringa"?"Cápsulas":"Jeringa"};expect(matchOfferToProduct(p,o).status,p.id).toBe("REJECTED");}
 });
});