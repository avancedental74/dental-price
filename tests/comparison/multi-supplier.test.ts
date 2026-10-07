import { describe, expect, it } from "vitest";
import type { CanonicalProduct, SupplierOffer } from "../../src/types/domain";
import { compareSupplierOffers } from "../../src/domain/comparison";

const product: CanonicalProduct = {
  id: "filtek-xte-a3-body-3g",
  manufacturer: "Solventum",
  brand: "Filtek",
  family: "Filtek Supreme XTE",
  productName: "Composite universal",
  variant: "Body",
  shade: "A3",
  presentation: "Jeringa",
  quantity: 3,
  unit: "g",
  packCount: 1,
  manufacturerReference: "4910A3B",
  category: "Composites",
  normalizedName: "filtek supreme xte a3 body 3 g syringe",
  active: true
};

function offer(supplierId:string, price:number, overrides:Partial<SupplierOffer>={}):SupplierOffer {
  return {
    supplierId,
    supplierSku:supplierId+"-sku",
    manufacturerReference:"4910A3B",
    rawName:"Filtek Supreme XTE A3 Body jeringa 3 g",
    normalizedName:"filtek supreme xte a3 body syringe 3 g solventum",
    productUrl:"https://example.com/"+supplierId,
    presentation:"Jeringa",
    quantity:3,
    unit:"g",
    packCount:1,
    variant:"Body",
    shade:"A3",
    stockStatus:"in_stock",
    regularPrice:price,
    vatStatus:"included",
    currency:"EUR",
    shippingCost:0,
    observedAt:new Date().toISOString(),
    sourceStatus:"normal",
    ...overrides
  };
}

describe("multi supplier comparison",()=>{
  it("ranks exact matches from all three MVP suppliers by current displayed price",()=>{
    const result=compareSupplierOffers(product,[
      offer("dentaltix",42.9),
      offer("proclinic",39.5),
      offer("dental-iberica",41.2)
    ]);
    expect(result.ranked.map(x=>x.offer.supplierId)).toEqual(["proclinic","dental-iberica","dentaltix"]);
    expect(result.ranked.every(x=>x.match.status==="EXACT")).toBe(true);
  });

  it("excludes a conflicting shade even when its price is lower",()=>{
    const result=compareSupplierOffers(product,[
      offer("dentaltix",42.9),
      offer("proclinic",10,{shade:"A3.5"})
    ]);
    expect(result.ranked.map(x=>x.offer.supplierId)).toEqual(["dentaltix"]);
    expect(result.rejected[0].match.status).toBe("REJECTED");
  });

  it("excludes unavailable stock from the winner ranking",()=>{
    const result=compareSupplierOffers(product,[
      offer("dentaltix",42.9),
      offer("proclinic",30,{stockStatus:"unavailable"})
    ]);
    expect(result.ranked[0].offer.supplierId).toBe("dentaltix");
  });

  it("excludes quarantined prices",()=>{
    const result=compareSupplierOffers(product,[
      offer("dentaltix",42.9),
      offer("proclinic",1,{sourceStatus:"quarantined"})
    ]);
    expect(result.ranked[0].offer.supplierId).toBe("dentaltix");
  });

  it("excludes stale prices older than 72 hours",()=>{
    const stale=new Date(Date.now()-80*60*60*1000).toISOString();
    const result=compareSupplierOffers(product,[
      offer("dentaltix",42.9),
      offer("dental-iberica",20,{observedAt:stale})
    ]);
    expect(result.ranked[0].offer.supplierId).toBe("dentaltix");
  });

  it("uses sale price when present",()=>{
    const result=compareSupplierOffers(product,[
      offer("dentaltix",42.9),
      offer("proclinic",50,{salePrice:38.5})
    ]);
    expect(result.ranked[0].offer.supplierId).toBe("proclinic");
  });
});