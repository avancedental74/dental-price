import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CanonicalProduct, SupplierOffer } from "../../src/types/domain";
import { matchOfferToProduct } from "../../src/domain/matching/matcher";

const products=JSON.parse(readFileSync(resolve(process.cwd(),"data/products.json"),"utf8")) as CanonicalProduct[];
function exactOffer(product:CanonicalProduct):SupplierOffer{
  return {supplierId:"validation",manufacturer:product.manufacturer,manufacturerReference:product.manufacturerReference,eanGtin:product.eanGtin,rawName:product.normalizedName,normalizedName:product.normalizedName,productUrl:"https://example.com/"+product.id,presentation:product.presentation,quantity:product.quantity,unit:product.unit,packCount:product.packCount,variant:product.variant,shade:product.shade,stockStatus:"in_stock",regularPrice:10,vatStatus:"included",currency:"EUR",shippingCost:0,observedAt:new Date().toISOString(),sourceStatus:"normal"};
}

describe("catalog-wide matching regression",()=>{
  it("matches every canonical product exactly against its own identifiers and packaging",()=>{
    expect(products.length).toBeGreaterThanOrEqual(70);
    for(const product of products){
      const result=matchOfferToProduct(product,exactOffer(product));
      expect(result.status,product.id).toBe("EXACT");
    }
  });

  it("rejects contradictory manufacturer references across the whole catalog",()=>{
    for(let i=0;i<products.length;i++){
      const product=products[i];
      const other=products[(i+1)%products.length];
      const offer={...exactOffer(product),manufacturerReference:other.manufacturerReference};
      const result=matchOfferToProduct(product,offer);
      expect(result.status,product.id+" vs "+other.id).toBe("REJECTED");
    }
  });
});