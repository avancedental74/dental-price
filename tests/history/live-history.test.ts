import { describe, expect, it } from "vitest";
import { recordLiveSearchHistory } from "../../src/services/live-history";
import type { CanonicalProduct, SupplierOffer } from "../../src/types/domain";

const product:CanonicalProduct={
  id:"live-demo",manufacturer:"Solventum",family:"Demo",productName:"Demo",presentation:"Jeringa",
  quantity:3,unit:"g",packCount:1,manufacturerReference:"4910A3B",category:"test",normalizedName:"demo",active:true
};
const offer:SupplierOffer={
  supplierId:"dentaltix",supplierSku:"053M4910A3B",manufacturerReference:"4910A3B",rawName:"Demo",
  normalizedName:"demo",productUrl:"https://example.com/demo",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,
  stockStatus:"in_stock",regularPrice:44.9,salePrice:44.9,vatStatus:"included",currency:"EUR",
  observedAt:"2026-10-08T08:00:00.000Z",sourceStatus:"normal",sourceMode:"automatic",
  verificationKind:"live",verificationSessionId:"session-1",verifiedAt:"2026-10-08T08:00:00.000Z"
};

describe("live history",()=>{
  it("stores verified live observations under the canonical catalog product when refs match",()=>{
    const catalog=[{...product,id:"filtek-xte-4910a3b"}];
    const result=recordLiveSearchHistory([],[{product,offers:[offer]}],catalog);
    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe("filtek-xte-4910a3b");
    expect(result[0].supplierSku).toBe("053M4910A3B");
  });

  it("does not store non-live offers",()=>{
    const result=recordLiveSearchHistory([],[{product,offers:[{...offer,verificationKind:"snapshot"}]}],[product]);
    expect(result).toHaveLength(0);
  });
});
