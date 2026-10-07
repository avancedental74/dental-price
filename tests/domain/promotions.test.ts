import { describe, expect, it } from "vitest";
import { extractPromotionFromText, promotionForObservedPrices } from "../../src/domain/promotions";
describe("promotion extraction",()=>{
 it("extracts buy-x-get-y",()=>expect(extractPromotionFromText("Oferta 3+1 hasta fin de mes")).toMatchObject({type:"buy_x_get_y",minQty:3,freeQty:1}));
 it("extracts percentage discounts",()=>expect(extractPromotionFromText("-25% promoción")).toMatchObject({type:"percentage_discount",discountPercent:25}));
 it("extracts free shipping",()=>expect(extractPromotionFromText("Envío gratis")).toMatchObject({type:"free_shipping"}));
 it("does not double-apply a displayed markdown already reflected in salePrice",()=>{
   expect(promotionForObservedPrices("-30% oferta",64.14,44.90)).toBeUndefined();
 });
 it("keeps a 3+1 even when a sale price is present",()=>{
   expect(promotionForObservedPrices("Promoción 3+1",114.14,79.90)).toMatchObject({type:"buy_x_get_y",minQty:3,freeQty:1});
 });
});
