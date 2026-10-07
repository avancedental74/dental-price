import { describe, expect, it } from "vitest";
import { calculateOpportunityScore } from "../../src/domain/opportunity";

const base={
  currentPrice:40,average30d:45,average90d:46,min90d:38,max90d:55,historicalMin:35,historicalMax:60,observations30d:4,observations90d:8,observationsTotal:12
};

describe("Opportunity Score",()=>{
  it("returns insufficient when history is too short",()=>{
    const r=calculateOpportunityScore({stats:{...base,observationsTotal:2},currentPrice:40,isFresh:true,inStock:true,hasActivePromotion:false});
    expect(r.score).toBeNull();
    expect(r.label).toBe("insuficiente");
  });

  it("scores a clearly cheap price as good or exceptional",()=>{
    const r=calculateOpportunityScore({stats:{...base,currentPrice:36,average30d:45,average90d:46,min90d:36,max90d:55,historicalMin:35,historicalMax:60},currentPrice:36,isFresh:true,inStock:true,hasActivePromotion:true});
    expect(r.score).not.toBeNull();
    expect(r.score as number).toBeGreaterThanOrEqual(61);
  });

  it("scores an expensive price low",()=>{
    const r=calculateOpportunityScore({stats:{...base,currentPrice:56,average30d:44,average90d:45,min90d:35,max90d:56,historicalMin:34,historicalMax:60},currentPrice:56,isFresh:true,inStock:true,hasActivePromotion:false});
    expect(r.score as number).toBeLessThanOrEqual(40);
  });

  it("penalizes stale data",()=>{
    const fresh=calculateOpportunityScore({stats:base,currentPrice:40,isFresh:true,inStock:true,hasActivePromotion:false});
    const stale=calculateOpportunityScore({stats:base,currentPrice:40,isFresh:false,inStock:true,hasActivePromotion:false});
    expect(stale.score as number).toBeLessThan(fresh.score as number);
  });

  it("penalizes unavailable stock",()=>{
    const available=calculateOpportunityScore({stats:base,currentPrice:40,isFresh:true,inStock:true,hasActivePromotion:false});
    const unavailable=calculateOpportunityScore({stats:base,currentPrice:40,isFresh:true,inStock:false,hasActivePromotion:false});
    expect(unavailable.score as number).toBeLessThan(available.score as number);
  });

  it("adds a promotion bonus without overriding bad fundamentals",()=>{
    const noPromo=calculateOpportunityScore({stats:base,currentPrice:40,isFresh:true,inStock:true,hasActivePromotion:false});
    const promo=calculateOpportunityScore({stats:base,currentPrice:40,isFresh:true,inStock:true,hasActivePromotion:true});
    expect(promo.score as number).toBeGreaterThan(noPromo.score as number);
    expect((promo.score as number)-(noPromo.score as number)).toBeLessThanOrEqual(10);
  });
});