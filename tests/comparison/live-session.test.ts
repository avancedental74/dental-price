import { describe,expect,it } from "vitest";
import { compareSupplierOffers } from "../../src/domain/comparison";
import type { CanonicalProduct,SupplierOffer } from "../../src/types/domain";

const product:CanonicalProduct={
  id:"p",manufacturer:"3M",family:"Test",productName:"Test",presentation:"Jeringa",
  quantity:4,unit:"g",packCount:1,manufacturerReference:"ABC123",category:"Test",normalizedName:"test",active:true
};
function offer(overrides:Partial<SupplierOffer>):SupplierOffer{
  return {
    supplierId:"supplier",manufacturerReference:"ABC123",rawName:"Test",normalizedName:"test",
    productUrl:"https://example.com/p",presentation:"Jeringa",quantity:4,unit:"g",packCount:1,
    stockStatus:"in_stock",regularPrice:10,vatStatus:"included",vatRate:21,currency:"EUR",
    shippingCost:0,shippingCostVatIncluded:true,shippingVatRate:21,freeShippingThreshold:0,
    freeShippingThresholdBasis:"gross",shippingPolicyObservedAt:new Date().toISOString(),
    shippingPolicySourceUrl:"https://example.com/shipping",observedAt:new Date().toISOString(),
    sourceStatus:"normal",sourceMode:"automatic",...overrides
  };
}

describe("live comparison sessions",()=>{
  it("does not allow a recent snapshot to win a live search",()=>{
    const result=compareSupplierOffers(product,[offer({verificationKind:"snapshot"})],1,{requiredLiveSessionId:"session-1"});
    expect(result.ranked).toHaveLength(0);
  });

  it("only ranks an offer from the required live session",()=>{
    const result=compareSupplierOffers(product,[
      offer({supplierId:"old-live",verificationKind:"live",verificationSessionId:"session-old",verifiedAt:new Date().toISOString(),regularPrice:1}),
      offer({supplierId:"current-live",verificationKind:"live",verificationSessionId:"session-1",verifiedAt:new Date().toISOString(),regularPrice:10})
    ],1,{requiredLiveSessionId:"session-1"});
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0].offer.supplierId).toBe("current-live");
  });
});
