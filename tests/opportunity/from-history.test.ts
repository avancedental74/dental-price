import { describe, expect, it } from "vitest";
import type { PriceObservation } from "../../src/domain/history";
import { opportunityFromHistory } from "../../src/domain/opportunity/from-history";

function obs(price:number,date:string):PriceObservation{
  return {id:date,productId:"p",supplierId:"s",supplierSku:"sku",observedAt:date,lastSeenAt:date,seenCount:1,regularPrice:price,effectivePrice:price,stockStatus:"in_stock",sourceUrl:"https://example.com"};
}

describe("opportunityFromHistory",()=>{
  it("derives a positive score from a cheap current observation",()=>{
    const h=[
      obs(50,"2026-08-01T00:00:00.000Z"),
      obs(48,"2026-08-25T00:00:00.000Z"),
      obs(46,"2026-09-10T00:00:00.000Z"),
      obs(36,"2026-10-06T00:00:00.000Z")
    ];
    const r=opportunityFromHistory(h,{now:new Date("2026-10-07T12:00:00.000Z"),isFresh:true,inStock:true,hasActivePromotion:true});
    expect(r.sufficientData).toBe(true);
    expect(r.score as number).toBeGreaterThan(60);
  });

  it("returns insufficient when only two observations exist",()=>{
    const h=[obs(40,"2026-10-01T00:00:00.000Z"),obs(39,"2026-10-06T00:00:00.000Z")];
    const r=opportunityFromHistory(h,{now:new Date("2026-10-07T12:00:00.000Z"),isFresh:true,inStock:true,hasActivePromotion:false});
    expect(r.label).toBe("insuficiente");
  });
});