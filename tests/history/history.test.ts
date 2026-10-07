import { describe, expect, it } from "vitest";
import type { SupplierOffer } from "../../src/types/domain";
import { appendObservation, calculateHistoryStats } from "../../src/domain/history";

function offer(observedAt:string,overrides:Partial<SupplierOffer>={}):SupplierOffer{
  return {
    supplierId:"dentaltix",supplierSku:"sku-1",manufacturerReference:"ref-1",rawName:"Product",normalizedName:"product",productUrl:"https://example.com/p",
    stockStatus:"in_stock",regularPrice:40,vatStatus:"included",currency:"EUR",shippingCost:0,observedAt,sourceStatus:"normal",...overrides
  };
}

describe("price history",()=>{
  it("appends the first observation",()=>{
    const r=appendObservation([],"p1",offer("2026-10-01T10:00:00.000Z"),40);
    expect(r.appended).toBe(true);
    expect(r.history).toHaveLength(1);
    expect(r.history[0].seenCount).toBe(1);
  });

  it("compacts an identical repeated observation",()=>{
    const first=appendObservation([],"p1",offer("2026-10-01T10:00:00.000Z"),40).history;
    const second=appendObservation(first,"p1",offer("2026-10-02T10:00:00.000Z"),40);
    expect(second.appended).toBe(false);
    expect(second.compacted).toBe(true);
    expect(second.history).toHaveLength(1);
    expect(second.history[0].seenCount).toBe(2);
    expect(second.history[0].lastSeenAt).toBe("2026-10-02T10:00:00.000Z");
  });

  it("creates a new observation when price changes",()=>{
    let h=appendObservation([],"p1",offer("2026-10-01T10:00:00.000Z"),40).history;
    h=appendObservation(h,"p1",offer("2026-10-02T10:00:00.000Z",{salePrice:35}),35).history;
    expect(h).toHaveLength(2);
    expect(h[1].salePrice).toBe(35);
  });

  it("creates a new observation when stock changes",()=>{
    let h=appendObservation([],"p1",offer("2026-10-01T10:00:00.000Z"),40).history;
    h=appendObservation(h,"p1",offer("2026-10-02T10:00:00.000Z",{stockStatus:"unavailable"}),40).history;
    expect(h).toHaveLength(2);
  });

  it("creates a new observation when promotion changes",()=>{
    let h=appendObservation([],"p1",offer("2026-10-01T10:00:00.000Z"),40).history;
    h=appendObservation(h,"p1",offer("2026-10-02T10:00:00.000Z",{promotion:{type:"percentage_discount",description:"10%",discountPercent:10}}),36).history;
    expect(h).toHaveLength(2);
    expect(h[1].promotionSignature).toContain("percentage_discount");
  });

  it("calculates 30/90 day and historical stats",()=>{
    const now=new Date("2026-10-07T12:00:00.000Z");
    const history=[30,35,40,50].map((price,i)=>({
      id:"id"+i,productId:"p1",supplierId:"s",supplierSku:"sku",
      observedAt:["2026-07-01T00:00:00.000Z","2026-08-20T00:00:00.000Z","2026-09-20T00:00:00.000Z","2026-10-06T00:00:00.000Z"][i],
      lastSeenAt:["2026-07-01T00:00:00.000Z","2026-08-20T00:00:00.000Z","2026-09-20T00:00:00.000Z","2026-10-06T00:00:00.000Z"][i],
      seenCount:1,requestedQuantity:1,regularPrice:price,effectiveUnitCost:price,effectiveTotalCost:price,stockStatus:"in_stock",sourceUrl:"https://example.com"
    }));
    const stats=calculateHistoryStats(history,now);
    expect(stats.currentPrice).toBe(50);
    expect(stats.average30d).not.toBeNull();
    expect(stats.average90d).not.toBeNull();
    expect(stats.coverageDaysTotal).toBeGreaterThan(0);
    expect(stats.min90d).toBe(35);
    expect(stats.max90d).toBe(50);
    expect(stats.historicalMin).toBe(30);
    expect(stats.historicalMax).toBe(50);
  });
});