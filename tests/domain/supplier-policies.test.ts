import { describe, expect, it } from "vitest";
import type { SupplierOffer } from "../../src/types/domain";
import { applySupplierPolicy } from "../../src/domain/supplier-policies";

const offer:SupplierOffer={supplierId:"dentalcost",rawName:"x",normalizedName:"x",productUrl:"https://www.dentalcost.es/x",stockStatus:"in_stock",regularPrice:10,vatStatus:"excluded",vatRate:10,currency:"EUR",observedAt:new Date().toISOString(),sourceStatus:"normal"};
describe("supplier policies",()=>{
 it("applies versioned shipping conditions outside the connector",()=>{
  const result=applySupplierPolicy(offer,{supplierId:"dentalcost",zone:"ES_PENINSULA",shippingCost:5.8,shippingCostVatIncluded:false,shippingVatRate:21,freeShippingThreshold:120,freeShippingThresholdBasis:"gross",observedAt:"2026-10-07T00:00:00.000Z",sourceUrl:"https://www.dentalcost.es/"});
  expect(result.shippingCost).toBe(5.8); expect(result.freeShippingThreshold).toBe(120); expect(result.freeShippingThresholdBasis).toBe("gross");
 });
});