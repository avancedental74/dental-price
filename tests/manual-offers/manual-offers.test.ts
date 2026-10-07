import { describe, expect, it } from "vitest";
import type { CanonicalProduct } from "../../src/types/domain";
import { buildManualOffer, upsertManualOffer } from "../../src/services/manual-offers";
import { matchOfferToProduct } from "../../src/domain/matching/matcher";
import { calculatePricing } from "../../src/domain/pricing";

const product:CanonicalProduct={
  id:"filtek-xte-4910b2b",manufacturer:"Solventum",brand:"Filtek",family:"Filtek Supreme XTE",productName:"Composite universal",variant:"Body",shade:"B2",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,manufacturerReference:"4910B2B",category:"Composites",normalizedName:"filtek supreme xte b2 body jeringa 3 g",active:true
};

describe("manual supplier offers",()=>{
  it("builds a traceable exact manual offer",()=>{
    const offer=buildManualOffer(product,{supplierId:"proclinic",productUrl:"https://www.proclinic.es/producto",price:48.39,vatStatus:"excluded",vatRate:10,stockStatus:"in_stock",shippingCost:4.95,shippingVatRate:21,shippingCostVatIncluded:false});
    expect(offer.sourceMode).toBe("manual");
    expect(offer.manufacturerReference).toBe("4910B2B");
    expect(matchOfferToProduct(product,offer).status).toBe("EXACT");
  });

  it("cannot become economically complete when shipping is unknown",()=>{
    const offer=buildManualOffer(product,{supplierId:"proclinic",productUrl:"https://www.proclinic.es/producto",price:48.39,vatStatus:"excluded",vatRate:10,stockStatus:"in_stock"});
    const pricing=calculatePricing(offer,{requestedQuantity:1,includeVat:true});
    expect(pricing.warnings).toContain("Transporte no confirmado");
  });

  it("rejects zero prices and non-http URLs",()=>{
    expect(()=>buildManualOffer(product,{supplierId:"proclinic",productUrl:"https://www.proclinic.es/producto",price:0,vatStatus:"included",stockStatus:"in_stock"})).toThrow();
    expect(()=>buildManualOffer(product,{supplierId:"proclinic",productUrl:"javascript:alert(1)",price:10,vatStatus:"included",stockStatus:"in_stock"})).toThrow();
  });

  it("upserts one offer per supplier and manufacturer reference",()=>{
    const first=buildManualOffer(product,{supplierId:"proclinic",productUrl:"https://www.proclinic.es/a",price:50,vatStatus:"included",stockStatus:"in_stock",shippingCost:0,shippingCostVatIncluded:true});
    const second=buildManualOffer(product,{supplierId:"proclinic",productUrl:"https://www.proclinic.es/b",price:49,vatStatus:"included",stockStatus:"in_stock",shippingCost:0,shippingCostVatIncluded:true});
    const result=upsertManualOffer([first],second);
    expect(result).toHaveLength(1);
    expect(result[0].regularPrice).toBe(49);
  });
});