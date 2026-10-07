import { describe, expect, it } from "vitest";
import type { CanonicalProduct, SupplierOffer } from "../../src/types/domain";
import { compareSupplierOffers } from "../../src/domain/comparison";

const product: CanonicalProduct = {
  id:"p",manufacturer:"Solventum",family:"Filtek Supreme XTE",productName:"Composite",variant:"Body",shade:"A3",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,manufacturerReference:"4910A3B",category:"Composites",normalizedName:"filtek supreme xte a3 body syringe 3 g",active:true
};

function offer(id:string,price:number,extra:Partial<SupplierOffer>={}):SupplierOffer{
  return {supplierId:id,manufacturerReference:"4910A3B",rawName:"Filtek Supreme XTE A3 Body jeringa 3 g",normalizedName:"filtek supreme xte a3 body syringe 3 g solventum",productUrl:"https://example.com/"+id,presentation:"Jeringa",quantity:3,unit:"g",packCount:1,variant:"Body",shade:"A3",stockStatus:"in_stock",regularPrice:price,vatStatus:"included",currency:"EUR",observedAt:new Date().toISOString(),sourceStatus:"normal",...extra};
}

describe("comparison + pricing integration",()=>{
  it("lets a 3+1 offer beat a lower sticker price when buying four",()=>{
    const result=compareSupplierOffers(product,[
      offer("dentaltix",39),
      offer("proclinic",42,{promotion:{type:"buy_x_get_y",description:"3+1",minQty:3,freeQty:1}})
    ],4);
    expect(result.ranked[0].offer.supplierId).toBe("proclinic");
    expect(result.ranked[0].pricing?.effectiveTotalCost).toBe(126);
    expect(result.ranked[1].pricing?.effectiveTotalCost).toBe(156);
  });

  it("includes shipping below threshold and can change the winner",()=>{
    const result=compareSupplierOffers(product,[
      offer("a",35,{shippingCost:9,freeShippingThreshold:100}),
      offer("b",38,{shippingCost:0})
    ],1);
    expect(result.ranked[0].offer.supplierId).toBe("b");
  });

  it("removes shipping when quantity crosses free-shipping threshold",()=>{
    const result=compareSupplierOffers(product,[
      offer("a",30,{shippingCost:9,freeShippingThreshold:100}),
      offer("b",31,{shippingCost:0})
    ],4);
    expect(result.ranked[0].offer.supplierId).toBe("a");
    expect(result.ranked[0].pricing?.shippingCost).toBe(0);
  });

  it("does not rank an offer when IVA or shipping are unknown",()=>{
    const result=compareSupplierOffers(product,[
      offer("complete",40,{shippingCost:0}),
      offer("incomplete",20,{vatStatus:"unknown",shippingCost:undefined})
    ],1);
    expect(result.ranked.map(x=>x.offer.supplierId)).toEqual(["complete"]);
    expect(result.rejected.some(x=>x.offer.supplierId==="incomplete")).toBe(true);
  });
});