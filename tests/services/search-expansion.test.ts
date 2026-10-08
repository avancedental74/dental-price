import {describe,it,expect} from "vitest";
import {mergeSupplierQueryOffers,planSupplierQueries} from "../../src/services/search-expansion";
import {applyAnomalyStatus} from "../../src/domain/anomaly";
import type {SupplierOffer} from "../../src/types/domain";
function offer(overrides:Partial<SupplierOffer>={}):SupplierOffer{
  return {
    supplierId:"dentaltix",supplierSku:"SKU123",manufacturerReference:"ABC-123",rawName:"Composite A3",
    normalizedName:"composite a3",productUrl:"https://example.com/123",
    regularPrice:18,stockStatus:"in_stock",vatStatus:"included",currency:"EUR",
    sourceStatus:"normal",observedAt:"2026-10-08T10:00:00Z",...overrides
  };
}
describe("safe universal search expansion",()=>{
  it("retains the original query and applies only lexical alternatives",()=>{
    expect(planSupplierQueries("resina compuesta A3 3 g",true))
      .toEqual(["resina compuesta A3 3 g","composite A3 3 g"]);
    expect(planSupplierQueries("guantes nitrilo M",true))
      .toEqual(["guantes nitrilo M","guante nitrilo M"]);
    expect(planSupplierQueries("filtek supreme A3",true))
      .toEqual(["filtek supreme A3"]);
    expect(planSupplierQueries("implantes",false)).toEqual(["implantes"]);
  });
  it("does not expand manufacturer codes or EANs",()=>{
    expect(planSupplierQueries("4910A3B",true)).toEqual(["4910A3B"]);
    expect(planSupplierQueries("8435001234567",true)).toEqual(["8435001234567"]);
  });
  it("deduplicates supplier listings across query synonyms",()=>{
    const rows=mergeSupplierQueryOffers([
      offer(),offer({observedAt:"2026-10-08T11:00:00Z"}),
      offer({supplierId:"dvd-dental"})
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find(o=>o.supplierId==="dentaltix")?.observedAt).toBe("2026-10-08T11:00:00Z");
  });
  it("does not rank a conflicting price from two search paths",()=>{
    const rows=mergeSupplierQueryOffers([offer(),offer({regularPrice:23})]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceStatus).toBe("suspicious");
  });
  it("keeps different shades and distinct references separate",()=>{
    const rows=mergeSupplierQueryOffers([
      offer({shade:"A3"}),offer({shade:"A3.5"}),
      offer({supplierSku:"OTHER",shade:"A3"})
    ]);
    expect(rows).toHaveLength(3);
  });
  it("historical checks do not clear a previously suspicious or quarantined source",()=>{
    expect(applyAnomalyStatus(offer({sourceStatus:"suspicious"})).sourceStatus).toBe("suspicious");
    expect(applyAnomalyStatus(offer({sourceStatus:"quarantined"})).sourceStatus).toBe("quarantined");
  });

});
