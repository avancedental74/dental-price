import { describe, expect, it } from "vitest";
import type { SupplierOffer } from "../../src/types/domain";
import { groupLiveOffers } from "../../src/services/live-prices";

function offer(overrides:Partial<SupplierOffer>):SupplierOffer{
  return {
    supplierId:"supplier",
    rawName:"Tetric EvoCeram",
    normalizedName:"tetric evoceram",
    productUrl:"https://example.com/product",
    stockStatus:"in_stock",
    regularPrice:50,
    salePrice:50,
    vatStatus:"excluded",
    vatRate:10,
    currency:"EUR",
    observedAt:"2026-10-08T10:00:00.000Z",
    sourceStatus:"normal",
    sourceMode:"automatic",
    verificationKind:"live",
    verificationSessionId:"session-1",
    verifiedAt:"2026-10-08T10:00:00.000Z",
    ...overrides
  };
}

describe("groupLiveOffers",()=>{
  it("merges a no-reference supplier only when critical variant fields agree",()=>{
    const groups=groupLiveOffers([
      offer({
        supplierId:"dentaltix",
        manufacturer:"IVOCLAR VIVADENT",
        manufacturerReference:"590323WW",
        supplierSku:"45TE590323",
        rawName:"Tetric EvoCeram Composite Universal A3.5 Dentina Jeringa 3 g",
        normalizedName:"tetric evoceram composite universal a3.5 dentin syringe 3 g",
        presentation:"Jeringa",quantity:3,unit:"g",packCount:1,variant:"Dentin",shade:"A3.5"
      }),
      offer({
        supplierId:"ortolan",
        supplierSku:"EVOCER-JERD3,5",
        rawName:"TETRIC EVOCERAM A3,5 Dentina Jeringa de 3grm",
        normalizedName:"tetric evoceram a3.5 dentin syringe 3 g",
        presentation:"Jeringa",quantity:3,unit:"g",packCount:1,variant:"Dentin",shade:"A3.5"
      })
    ]);
    expect(groups).toHaveLength(1);
    expect(new Set(groups[0].offers.map(x=>x.supplierId))).toEqual(new Set(["dentaltix","ortolan"]));
    expect(groups[0].manufacturerReference).toBe("590323WW");
  });

  it("does not merge capsules with a syringe even when names are similar",()=>{
    const groups=groupLiveOffers([
      offer({
        supplierId:"dentaltix",
        manufacturerReference:"590323WW",
        rawName:"Tetric EvoCeram A3.5 Dentina Jeringa 3 g",
        normalizedName:"tetric evoceram a3.5 dentin syringe 3 g",
        presentation:"Jeringa",quantity:3,unit:"g",packCount:1,variant:"Dentin",shade:"A3.5"
      }),
      offer({
        supplierId:"ortolan",
        rawName:"Tetric EvoCeram A3.5 Dentina 20 Cápsulas 0,2 g",
        normalizedName:"tetric evoceram a3.5 dentin 20 capsules 0.2 g",
        presentation:"Cápsulas",quantity:0.2,unit:"g",packCount:20,variant:"Dentin",shade:"A3.5"
      })
    ]);
    expect(groups).toHaveLength(2);
  });

  it("uses the most complete offer to build the live canonical product",()=>{
    const groups=groupLiveOffers([
      offer({
        supplierId:"supplier-a",
        manufacturerReference:"ABC123",
        rawName:"Example product",
        normalizedName:"example product"
      }),
      offer({
        supplierId:"supplier-b",
        manufacturerReference:"ABC123",
        manufacturer:"Example Maker",
        rawName:"Example product A2 syringe 3 g",
        normalizedName:"example product a2 syringe 3 g",
        presentation:"Jeringa",quantity:3,unit:"g",packCount:1,shade:"A2"
      })
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].product.manufacturer).toBe("Example Maker");
    expect(groups[0].product.presentation).toBe("Jeringa");
    expect(groups[0].product.quantity).toBe(3);
    expect(groups[0].product.shade).toBe("A2");
  });
  it("separates identical reference codes when manufacturer, shade, EAN or pack differs",()=>{
    const base={manufacturerReference:"SAME123",manufacturer:"Maker A",presentation:"Jeringa",
      quantity:3,unit:"g",packCount:1,shade:"A3"};
    const groups=groupLiveOffers([
      offer({supplierId:"dentaltix",...base,eanGtin:"1234567890123"}),
      offer({supplierId:"dentalcost",...base,eanGtin:"1234567890123"}),
      offer({supplierId:"dvd-dental",...base,shade:"A3.5",eanGtin:"1234567890123"}),
      offer({supplierId:"dentalexpress",...base,manufacturer:"Maker B",eanGtin:"1234567890123"}),
      offer({supplierId:"dentipak",...base,eanGtin:"9999999999999"}),
      offer({supplierId:"ortolan",...base,quantity:4,eanGtin:"1234567890123"})
    ]);
    expect(groups).toHaveLength(5);
    expect(groups[0].id).not.toEqual(groups[1].id);
    expect(groups.some(g=>g.offers.length===2)).toBe(true);
    expect(groups.every(g=>g.offers.every(o=>o.manufacturerReference==="SAME123"))).toBe(true);
  });

  it("does not merge identical names with incompatible packs when both lack a manufacturer reference",()=>{
    const first=offer({supplierId:"dentaltix",rawName:"Jeringas de composite A3",
      manufacturerReference:undefined,presentation:"Jeringa",quantity:3,unit:"g",packCount:1});
    const second=offer({supplierId:"dentalcost",rawName:"Jeringas de composite A3",
      manufacturerReference:undefined,presentation:"Jeringa",quantity:4,unit:"g",packCount:1});
    const groups=groupLiveOffers([first,second]);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map(g=>g.id)).size).toBe(2);
  });
  it("checks a new supplier against all members, not just the first with sparse attributes",()=>{
    const basic=offer({supplierId:"dentaltix",manufacturerReference:"SAME",quantity:undefined});
    const specified=offer({supplierId:"dentalcost",manufacturerReference:"SAME",quantity:3,unit:"g"});
    const conflict=offer({supplierId:"dvd-dental",manufacturerReference:"SAME",quantity:4,unit:"g"});
    const groups=groupLiveOffers([basic,specified,conflict]);
    expect(groups).toHaveLength(2);
  });

});
