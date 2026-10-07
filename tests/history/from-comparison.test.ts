import { describe, expect, it } from "vitest";
import type { MatchedSupplierOffer } from "../../src/domain/comparison/types";
import type { CanonicalProduct, SupplierOffer } from "../../src/types/domain";
import { persistComparisonHistory } from "../../src/domain/history/from-comparison";

const product:CanonicalProduct={
  id:"p1",manufacturer:"Solventum",family:"Filtek",productName:"Composite",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,category:"Composites",normalizedName:"filtek",active:true
};

const offer:SupplierOffer={
  supplierId:"proclinic",supplierSku:"sku",rawName:"Filtek",normalizedName:"filtek",productUrl:"https://example.com/p",stockStatus:"in_stock",regularPrice:42,vatStatus:"included",currency:"EUR",shippingCost:0,observedAt:"2026-10-07T10:00:00.000Z",sourceStatus:"normal"
};

function item(effective:number):MatchedSupplierOffer{
  return {
    product,offer,
    match:{status:"EXACT",score:100,hardReject:false,reasons:[],conflicts:[],canonicalProductId:"p1",supplierId:"proclinic",supplierSku:"sku"},
    pricing:{supplierId:"proclinic",requestedQuantity:1,paidUnits:1,receivedUnits:1,baseUnitPrice:42,subtotalBeforeVat:42,discountAmount:0,promotionalSubtotal:42,vatAmount:0,subtotalWithVat:42,shippingCost:0,effectiveTotalCost:effective,effectiveUnitCost:effective,warnings:[]},
    eligibleForRanking:true
  };
}

describe("persistComparisonHistory",()=>{
  it("stores effective total cost from comparison",()=>{
    const h=persistComparisonHistory([], [item(42)]);
    expect(h).toHaveLength(1);
    expect(h[0].effectiveUnitCost).toBe(42);
    expect(h[0].effectiveTotalCost).toBe(42);
    expect(h[0].requestedQuantity).toBe(1);
  });

  it("compacts repeated identical comparison results",()=>{
    const first=persistComparisonHistory([], [item(42)]);
    const repeated={...item(42),offer:{...offer,observedAt:"2026-10-07T12:00:00.000Z"}};
    const second=persistComparisonHistory(first,[repeated]);
    expect(second).toHaveLength(1);
    expect(second[0].seenCount).toBe(2);
  });
});