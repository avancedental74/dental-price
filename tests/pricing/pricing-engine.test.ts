import { describe, expect, it } from "vitest";
import type { SupplierOffer } from "../../src/types/domain";
import { calculatePricing } from "../../src/domain/pricing";

function offer(overrides:Partial<SupplierOffer>={}):SupplierOffer{
  return {
    supplierId:"supplier",rawName:"Product",normalizedName:"product",productUrl:"https://example.com/product",
    stockStatus:"in_stock",regularPrice:42,vatStatus:"included",currency:"EUR",observedAt:new Date().toISOString(),sourceStatus:"normal",
    ...overrides
  };
}

describe("Pricing Engine",()=>{
  it("calculates simple quantity",()=>{
    const p=calculatePricing(offer(),{requestedQuantity:3,includeVat:true});
    expect(p.effectiveTotalCost).toBe(126);
    expect(p.effectiveUnitCost).toBe(42);
  });

  it("applies percentage discount",()=>{
    const p=calculatePricing(offer({promotion:{type:"percentage_discount",description:"10%",discountPercent:10}}),{requestedQuantity:2,includeVat:true});
    expect(p.discountAmount).toBe(8.4);
    expect(p.effectiveTotalCost).toBe(75.6);
  });

  it("calculates 3+1 correctly for four requested units",()=>{
    const p=calculatePricing(offer({promotion:{type:"buy_x_get_y",description:"3+1",minQty:3,freeQty:1}}),{requestedQuantity:4,includeVat:true});
    expect(p.paidUnits).toBe(3);
    expect(p.receivedUnits).toBe(4);
    expect(p.effectiveTotalCost).toBe(126);
    expect(p.effectiveUnitCost).toBe(31.5);
  });

  it("handles 3+1 for eight requested units",()=>{
    const p=calculatePricing(offer({promotion:{type:"buy_x_get_y",description:"3+1",minQty:3,freeQty:1}}),{requestedQuantity:8,includeVat:true});
    expect(p.paidUnits).toBe(6);
    expect(p.effectiveTotalCost).toBe(252);
  });

  it("adds VAT when explicitly excluded and rate is known",()=>{
    const p=calculatePricing(offer({regularPrice:48.39,vatStatus:"excluded",vatRate:10}),{requestedQuantity:1,includeVat:true});
    expect(p.vatAmount).toBe(4.84);
    expect(p.subtotalWithVat).toBe(53.23);
  });

  it("does not invent VAT when unknown",()=>{
    const p=calculatePricing(offer({vatStatus:"unknown"}),{requestedQuantity:1,includeVat:true});
    expect(p.vatAmount).toBeNull();
    expect(p.warnings).toContain("IVA no confirmado");
  });

  it("charges shipping below free threshold",()=>{
    const p=calculatePricing(offer({regularPrice:30,shippingCost:4.95,freeShippingThreshold:100}),{requestedQuantity:2,includeVat:true});
    expect(p.shippingCost).toBe(4.95);
    expect(p.effectiveTotalCost).toBe(64.95);
  });

  it("removes shipping at threshold",()=>{
    const p=calculatePricing(offer({regularPrice:30,shippingCost:4.95,freeShippingThreshold:100}),{requestedQuantity:4,includeVat:true});
    expect(p.shippingCost).toBe(0);
    expect(p.effectiveTotalCost).toBe(120);
  });

  it("warns when shipping is unknown",()=>{
    const p=calculatePricing(offer({shippingCost:undefined,freeShippingThreshold:undefined}),{requestedQuantity:1,includeVat:true});
    expect(p.shippingCost).toBeNull();
    expect(p.warnings).toContain("Transporte no confirmado");
  });
  it("does not apply an expired promotion",()=>{
    const o={...baseOffer,promotion:{type:"buy_x_get_y" as const,description:"3+1",minQty:3,freeQty:1,validUntil:"2020-01-01"}};
    const result=calculatePricing(o,{requestedQuantity:4,includeVat:true});
    expect(result.paidUnits).toBe(4);
    expect(result.warnings).toContain("Promoción caducada");
  });

  it("applies a still-valid promotion",()=>{
    const o={...baseOffer,promotion:{type:"buy_x_get_y" as const,description:"3+1",minQty:3,freeQty:1,validUntil:"2999-01-01"}};
    const result=calculatePricing(o,{requestedQuantity:4,includeVat:true});
    expect(result.paidUnits).toBe(3);
  });
});
