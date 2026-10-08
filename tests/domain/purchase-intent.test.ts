import {describe,expect,it} from "vitest";
import {classifyPurchaseIntent} from "../../src/features/search/purchase-intent";
describe("purchase intent separation for any dental material",()=>{
  it("moves alginate mixing cups away from printing alginate",()=>{
    expect(classifyPurchaseIntent("alginato","Taza Alginato y Yeso Flexible Mediana")).toBe("related_accessory");
    expect(classifyPurchaseIntent("alginato","Alginato Turboprint Chroma (500g)")).toBe("requested_product");
  });
  it("moves implant screwdrivers away from implants",()=>{
    expect(classifyPurchaseIntent("implante","Aplicador implante de uso quirúrgico")).toBe("related_accessory");
    expect(classifyPurchaseIntent("implante","Implante dental cónico 4 x 10")).toBe("requested_product");
  });
  it("never hides an accessory that the user asked for",()=>{
    expect(classifyPurchaseIntent("taza alginato","Taza Alginato y Yeso Flexible")).toBe("requested_product");
    expect(classifyPurchaseIntent("espátula","Espátula para alginato")).toBe("requested_product");
  });
});
