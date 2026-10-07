import { describe, expect, it } from "vitest";
import type { CanonicalProduct, SupplierOffer } from "../../src/types/domain";
import { optimizeBasket } from "../../src/domain/basket";
const product=(id:string,ref:string):CanonicalProduct=>({id,manufacturer:"Solventum",family:id,productName:id,presentation:"Jeringa",quantity:1,unit:"ud",packCount:1,manufacturerReference:ref,category:"test",normalizedName:id,active:true});
const offer=(supplierId:string,ref:string,price:number,threshold:number):SupplierOffer=>({supplierId,manufacturer:"Solventum",manufacturerReference:ref,rawName:ref,normalizedName:ref,productUrl:"https://example.com/"+supplierId+"/"+ref,presentation:"Jeringa",quantity:1,unit:"ud",packCount:1,stockStatus:"in_stock",regularPrice:price,vatStatus:"included",currency:"EUR",shippingCost:6,shippingCostVatIncluded:true,freeShippingThreshold:threshold,freeShippingThresholdBasis:"gross",observedAt:new Date().toISOString(),sourceStatus:"normal"});
describe("basket optimizer",()=>{
 it("can prefer one supplier for the whole basket to avoid duplicated shipping",()=>{
  const a=product("a","A"), b=product("b","B");
  const result=optimizeBasket([
   {product:a,quantity:1,offers:[offer("x","A",30,50),offer("y","A",28,100)]},
   {product:b,quantity:1,offers:[offer("x","B",30,50),offer("y","B",28,100)]}
  ]);
  expect(result.total).toBe(60);
  expect(result.assignments.every(x=>x.supplierId==="x")).toBe(true);
 });
 it("reports products with no purchasable supplier",()=>{
  const a=product("a","A"); const bad={...offer("x","A",10,50),stockStatus:"unavailable" as const};
  const result=optimizeBasket([{product:a,quantity:1,offers:[bad]}]);
  expect(result.total).toBeNull(); expect(result.missingProductIds).toEqual(["a"]);
 });
});