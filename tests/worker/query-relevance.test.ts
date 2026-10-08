import {describe,expect,it} from "vitest";
import {relevantToQuery} from "../../worker/live-api";
import type {SupplierOffer} from "../../src/types/domain";

function offer(rawName:string):SupplierOffer{
  return {supplierId:"test",rawName,normalizedName:rawName.toLowerCase(),
    productUrl:"https://example.com/item",regularPrice:10,currency:"EUR",
    vatStatus:"unknown",stockStatus:"unknown",observedAt:new Date().toISOString(),
    sourceStatus:"normal"};
}

describe("supplier query precision",()=>{
  it("rejects model prefixes after broad discovery",()=>{
    expect(relevantToQuery(offer("Composite Filtek Z2500"),"Z250")).toBe(false);
    expect(relevantToQuery(offer("Composite Filtek Z250"),"Z250")).toBe(true);
  });
  it("does not substitute nearby shades",()=>{
    expect(relevantToQuery(offer("Tetric EvoCeram A3.5 Jeringa"),"Tetric EvoCeram A3")).toBe(false);
    expect(relevantToQuery(offer("Tetric EvoCeram A3 Jeringa"),"Tetric EvoCeram A3")).toBe(true);
    expect(relevantToQuery(offer("Tetric EvoCeram A3,5 Jeringa"),"Tetric EvoCeram A3.5")).toBe(true);
  });
  it("still finds broad dental products without a special-case category",()=>{
    expect(relevantToQuery(offer("Guantes nitrilo talla M 100 uds."),"guantes")).toBe(true);
    expect(relevantToQuery(offer("Cemento resinoso dual 5 ml"),"cemento")).toBe(true);
    expect(relevantToQuery(offer("Fresas diamantadas redondas"),"fresas")).toBe(true);
  });
});