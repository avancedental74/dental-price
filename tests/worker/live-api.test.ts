import {describe,expect,it} from "vitest";
import {relevantToQuery} from "../../worker/live-api";
import type {SupplierOffer} from "../../src/types/domain";

function offer(rawName:string):SupplierOffer{
  return {
    supplierId:"dentaltix",
    rawName,
    normalizedName:rawName.toLowerCase(),
    productUrl:"https://example.com/product",
    stockStatus:"in_stock",
    regularPrice:10,
    vatStatus:"unknown",
    currency:"EUR",
    observedAt:new Date().toISOString(),
    sourceStatus:"normal"
  };
}

describe("live worker query relevance",()=>{
  it("keeps explicit composite variants separate",()=>{
    expect(relevantToQuery(offer("Filtek Supreme XTE A3 Body Jeringa 3 gr"),"Filtek Supreme XTE A3 Body 3 g")).toBe(true);
    expect(relevantToQuery(offer("Filtek Supreme XTE A3 Dentina Jeringa 3 gr"),"Filtek Supreme XTE A3 Body 3 g")).toBe(false);
    expect(relevantToQuery(offer("Filtek Supreme XTE A3 Esmalte Jeringa 3 gr"),"Filtek Supreme XTE A3 Body 3 g")).toBe(false);
  });

  it("keeps packs and unit quantities separate",()=>{
    expect(relevantToQuery(offer("Filtek Supreme XTE A3 Body 20 Capsulas 0.2 gr"),"Filtek Supreme XTE A3 Body 3 g")).toBe(false);
  });
});
