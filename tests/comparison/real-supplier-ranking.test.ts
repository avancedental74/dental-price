import { describe, expect, it } from "vitest";
import type { CanonicalProduct, SupplierOffer } from "../../src/types/domain";
import { compareSupplierOffers } from "../../src/domain/comparison";

const product:CanonicalProduct={
  id:"filtek-xte-4910a3b",manufacturer:"Solventum",brand:"Filtek",family:"Filtek Supreme XTE",productName:"Composite universal",
  variant:"Body",shade:"A3",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,manufacturerReference:"4910A3B",
  category:"Composites",normalizedName:"filtek supreme xte a3 body jeringa 3 g",active:true
};
function offer(supplierId:string,price:number,shippingCost:number,threshold:number,basis:"net"|"gross"):SupplierOffer{
  return {
    supplierId,manufacturer:"Solventum",manufacturerReference:"4910A3B",rawName:"Filtek Supreme XTE A3 Body",
    normalizedName:"filtek supreme xte a3 body jeringa 3 g solventum",productUrl:"https://example.com/"+supplierId,
    presentation:"Jeringa",quantity:3,unit:"g",packCount:1,variant:"Body",shade:"A3",stockStatus:"in_stock",
    regularPrice:price,salePrice:price,vatStatus:"excluded",vatRate:10,currency:"EUR",
    shippingCost,shippingCostVatIncluded:false,shippingVatRate:21,freeShippingThreshold:threshold,freeShippingThresholdBasis:basis,
    deliveryZone:"ES_PENINSULA",observedAt:new Date().toISOString(),sourceStatus:"normal",sourceMode:"automatic"
  };
}

describe("real supplier ranking regression",()=>{
  it("ranks current Dentaltix economics ahead of DentalCost for one A3 Body syringe",()=>{
    const result=compareSupplierOffers(product,[
      offer("dentaltix",44.90,4.95,100,"net"),
      offer("dentalcost",47.86,5.80,120,"gross")
    ],1);
    expect(result.ranked).toHaveLength(2);
    expect(result.ranked[0].offer.supplierId).toBe("dentaltix");
    expect(result.ranked[0].pricing?.effectiveTotalCost).toBe(55.38);
    expect(result.ranked[1].pricing?.effectiveTotalCost).toBe(59.66);
  });

  it("removes shipping when each supplier threshold is reached",()=>{
    const result=compareSupplierOffers(product,[
      offer("dentaltix",44.90,4.95,100,"net"),
      offer("dentalcost",47.86,5.80,120,"gross")
    ],3);
    expect(result.ranked[0].offer.supplierId).toBe("dentaltix");
    expect(result.ranked[0].pricing?.shippingCost).toBe(0);
    expect(result.ranked[1].pricing?.shippingCost).toBe(0);
  });
});
