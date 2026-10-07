import { describe, expect, it } from "vitest";
import { extractPromotionFromText } from "../../src/domain/promotions";
describe("promotion extraction",()=>{
 it("extracts buy-x-get-y",()=>expect(extractPromotionFromText("Oferta 3+1 hasta fin de mes")).toMatchObject({type:"buy_x_get_y",minQty:3,freeQty:1}));
 it("extracts percentage discounts",()=>expect(extractPromotionFromText("-25% promoción")).toMatchObject({type:"percentage_discount",discountPercent:25}));
 it("extracts free shipping",()=>expect(extractPromotionFromText("Envío gratis")).toMatchObject({type:"free_shipping"}));
});