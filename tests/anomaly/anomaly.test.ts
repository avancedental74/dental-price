import { describe, expect, it } from "vitest";
import type { SupplierOffer } from "../../src/types/domain";
import type { PriceObservation } from "../../src/domain/history";
import { analyzeOfferAnomaly } from "../../src/domain/anomaly";

function offer(price:number,extra:Partial<SupplierOffer>={}):SupplierOffer{
  return {supplierId:"s",supplierSku:"sku",rawName:"P",normalizedName:"p",productUrl:"https://example.com/p",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,stockStatus:"in_stock",regularPrice:price,vatStatus:"included",currency:"EUR",observedAt:new Date().toISOString(),sourceStatus:"normal",...extra};
}
function previous(price:number,extra:Partial<PriceObservation>={}):PriceObservation{
  return {id:"x",productId:"p",supplierId:"s",supplierSku:"sku",observedAt:"2026-10-01T00:00:00.000Z",lastSeenAt:"2026-10-01T00:00:00.000Z",seenCount:1,requestedQuantity:1,regularPrice:price,effectiveUnitCost:price,stockStatus:"in_stock",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,sourceUrl:"https://example.com",...extra};
}
describe("anomaly engine",()=>{
  it("quarantines zero price",()=>expect(analyzeOfferAnomaly({offer:offer(0)}).severity).toBe("quarantined"));
  it("flags a >50% drop",()=>expect(analyzeOfferAnomaly({offer:offer(40),previous:previous(100)}).severity).toBe("suspicious"));
  it("quarantines a x10 error",()=>expect(analyzeOfferAnomaly({offer:offer(4),previous:previous(40)}).severity).toBe("quarantined"));
  it("flags >100% rise",()=>expect(analyzeOfferAnomaly({offer:offer(90),previous:previous(40)}).severity).toBe("suspicious"));
  it("does not compare source price against historical landed cost",()=>expect(analyzeOfferAnomaly({offer:offer(40),previous:previous(40,{effectiveUnitCost:80})}).severity).toBe("normal"));
  it("quarantines pack drift",()=>expect(analyzeOfferAnomaly({offer:offer(40,{packCount:20}),previous:previous(40)}).severity).toBe("quarantined"));
});