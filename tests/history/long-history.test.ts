import { describe, expect, it } from "vitest";
import type { PriceObservation } from "../../src/domain/history";
import { calculateHistoryStats } from "../../src/domain/history";
const obs=(id:string,start:string,end:string,price:number,stock="in_stock"):PriceObservation=>({id,productId:"p",supplierId:"s",observedAt:start,lastSeenAt:end,seenCount:1,requestedQuantity:1,regularPrice:price,effectiveUnitCost:price,effectiveTotalCost:price,stockStatus:stock,sourceUrl:"https://example.com"});
describe("long historical coverage",()=>{
 it("weights a constant price by time instead of observation count",()=>{
  const history=[obs("a","2026-07-01T00:00:00.000Z","2026-08-09T00:00:00.000Z",100),obs("b","2026-08-10T00:00:00.000Z","2026-09-08T00:00:00.000Z",80),obs("c","2026-09-09T00:00:00.000Z","2026-10-07T00:00:00.000Z",90)];
  const stats=calculateHistoryStats(history,new Date("2026-10-07T12:00:00.000Z"));
  expect(stats.coverageDaysTotal).toBeGreaterThan(90);
  expect(stats.average90d).not.toBeNull();
  expect(stats.historicalMin).toBe(80); expect(stats.historicalMax).toBe(100);
 });
 it("does not treat out-of-stock intervals as zero price",()=>{
  const history=[obs("a","2026-08-01T00:00:00.000Z","2026-09-01T00:00:00.000Z",50),obs("b","2026-09-02T00:00:00.000Z","2026-10-01T00:00:00.000Z",50,"unavailable")];
  const stats=calculateHistoryStats(history,new Date("2026-10-02T00:00:00.000Z"));
  expect(stats.historicalMin).toBe(50);
 });
});