import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonicalProduct, SupplierOffer } from "../../src/types/domain";
import { matchOfferToProduct } from "../../src/domain/matching/matcher";

const here=dirname(fileURLToPath(import.meta.url));
const fixture=JSON.parse(readFileSync(resolve(here,"../../fixtures/validation/ground-truth.json"),"utf8"));

describe("ground truth validation",()=>{
  it("contains at least 30 curated cases",()=>{
    expect(fixture.cases.length).toBeGreaterThanOrEqual(30);
  });

  it("has zero false-positive EXACT matches",()=>{
    for(const c of fixture.cases){
      const canonical:CanonicalProduct={
        id:c.id,productName:c.canonical.family,category:"validation",normalizedName:c.canonical.family.toLowerCase(),active:true,...c.canonical
      };
      const offer:SupplierOffer={
        rawName:c.offer.normalizedName,productUrl:"https://example.com",stockStatus:"in_stock",regularPrice:1,vatStatus:"included",currency:"EUR",observedAt:new Date().toISOString(),sourceStatus:"normal",...c.offer
      };
      const result=matchOfferToProduct(canonical,offer);
      if(c.expected==="REJECTED") expect(result.status,c.id).toBe("REJECTED");
      else expect(result.status,c.id).toBe("EXACT");
    }
  });
});