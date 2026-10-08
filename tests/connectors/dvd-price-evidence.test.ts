import {describe,expect,it} from "vitest";
import type {SupplierOffer} from "../../src/types/domain";
import type {DvdKlevuRecord} from "../../src/connectors/live-search";
import {verifiedDvdDetailOffers} from "../../src/connectors/dvd-dental/verify-record";
const offer=(props:Partial<SupplierOffer>={}):SupplierOffer=>({
  supplierId:"dvd-dental",supplierSku:"3139000",manufacturerReference:"B201875",
  rawName:"Alginato Turboprint Chroma 500g",normalizedName:"alginato turboprint chroma 500 g",
  productUrl:"https://www.dvd-dental.com/alginato-turboprint-chroma-500g/",
  regularPrice:5.05,vatStatus:"excluded",vatRate:21,stockStatus:"in_stock",
  sourceStatus:"normal",currency:"EUR",observedAt:"2026-10-08T14:00:00Z",...props
});
describe("DVD search index versus verified product page",()=>{
  it("ignores stale index prices and uses only SKU-matched page evidence",()=>{
    const record:DvdKlevuRecord={sku:"3139000",name:"Alginato Turboprint Chroma (500g)",price:"9.24",url:"https://www.dvd-dental.com/alginato-turboprint-chroma-500g/"};
    const results=verifiedDvdDetailOffers(record,[offer()]);
    expect(results).toHaveLength(1);
    expect(results[0].regularPrice).toBe(5.05);
    expect(results[0].priceVerification).toBe("detail");
  });
  it("rejects the wrong SKU, wrong manufacturer reference or ambiguous index",()=>{
    expect(verifiedDvdDetailOffers({sku:"OTHER"},[offer()])).toHaveLength(0);
    expect(verifiedDvdDetailOffers({sku:"3139000","nº_pieza_fabricante":"DIFFERENT"},[offer()])).toHaveLength(0);
    expect(verifiedDvdDetailOffers({name:"Alginato"},[offer()])).toHaveLength(0);
  });
  it("cannot assume a matching parent page verifies every unrelated variant",()=>{
    expect(verifiedDvdDetailOffers({sku:"3139000"},[offer(),offer({supplierSku:"3139001",regularPrice:7})])).toHaveLength(1);
  });
});
