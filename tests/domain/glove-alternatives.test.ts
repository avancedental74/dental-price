import {describe,it,expect} from "vitest";
import type {SupplierOffer,CanonicalProduct} from "../../src/types/domain";
import type {LiveSearchGroup} from "../../src/services/live-prices";
import {compareGloveAlternatives,extractGloveProperties,mergedGloveProperties} from "../../src/features/gloves/compare";

const now=()=>new Date().toISOString();
function makeGroup(name:string,count:number,price:number,supplierId:string,ref:string,opts:Partial<SupplierOffer>={}):LiveSearchGroup{
  const product:CanonicalProduct={
    id:ref,manufacturer:"Fabricante "+ref,family:name,productName:name,
    presentation:"Caja",quantity:count,unit:"unit",packCount:1,
    manufacturerReference:ref,category:"Guantes",normalizedName:name.toLowerCase(),active:true
  };
  const offer:SupplierOffer={
    supplierId,supplierSku:ref,manufacturer:product.manufacturer,
    manufacturerReference:ref,rawName:name,normalizedName:name.toLowerCase(),
    productUrl:"https://example.com/"+ref,presentation:"Caja",quantity:count,unit:"unit",packCount:1,
    stockStatus:"in_stock",regularPrice:price,vatStatus:"excluded",vatRate:21,
    currency:"EUR",shippingCost:4,shippingCostVatIncluded:true,
    shippingPolicyObservedAt:now(),observedAt:now(),sourceStatus:"normal",
    sourceMode:"automatic",verificationKind:"live",verificationSessionId:"session-a",
    verifiedAt:now(),...opts
  };
  return {
    id:ref,label:name,manufacturerReference:ref,
    identityLevel:"exact_identity",identityReasons:["Referencia de fabricante acreditada"],
    product,offers:[offer]
  };
}
const filters={material:"Nitrilo",size:"M",powder:"Sin polvo",sterile:"No estériles"} as const;
describe("safe cross-brand glove comparison",()=>{
  it("keeps sterility, material, powder and size as distinct attributes",()=>{
    const parsed=extractGloveProperties("Guantes de nitrilo talla M sin polvo no estériles azul 100 uds.");
    expect(parsed.material).toBe("Nitrilo");
    expect(parsed.size).toBe("M");
    expect(parsed.powder).toBe("Sin polvo");
    expect(parsed.sterile).toBe("No estériles");
    expect(parsed.units).toBe("100");
    expect(extractGloveProperties("Guantes látex Nº 6 estériles 50 uds.").size).toBe("6");
  });
  it("does not rank cross-brand alternatives without required filters",()=>{
    const g=makeGroup("Guantes de nitrilo talla M sin polvo no estériles 100 uds.",100,20,"dentalcost","G100");
    const result=compareGloveAlternatives([g],{material:"Nitrilo"},"session-a");
    expect(result.ready).toBe(false);
    expect(result.ranked).toHaveLength(0);
    expect(result.unverified[0].issues).toContain("Completa los filtros imprescindibles");
  });
  it("normalizes real delivered cost by number of gloves without pretending it is the cost of 100 purchased",()=>{
    const a=makeGroup("Guantes de nitrilo talla M sin polvo no estériles 100 uds.",100,20,"dentalcost","G100");
    const b=makeGroup("Guantes de nitrilo talla M sin polvo no estériles 200 uds.",200,32,"dentaltix","G200");
    const result=compareGloveAlternatives([a,b],{...filters},"session-a");
    expect(result.ready).toBe(true);
    expect(result.ranked).toHaveLength(2);
    expect(result.ranked[0].supplierId).toBe("dentaltix");
    expect(result.ranked[0].effectiveBoxCost).toBeCloseTo(42.72,2);
    expect(result.ranked[0].effectiveCostPer100).toBeCloseTo(21.36,2);
    expect(result.ranked[1].effectiveCostPer100).toBeCloseTo(28.2,2);
  });
  it("filters out wrong size and wrong material",()=>{
    const good=makeGroup("Guantes nitrilo talla M sin polvo no estériles 100 uds.",100,12,"dentaltix","GN");
    const wrong=makeGroup("Guantes látex talla L sin polvo no estériles 100 uds.",100,5,"dentalcost","GL");
    const result=compareGloveAlternatives([good,wrong],filters,"session-a");
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0].reference).toBe("GN");
  });
  it("never counts a stale, unverified, unknown stock, or different-session offer as a winner",()=>{
    const name="Guantes nitrilo talla M sin polvo no estériles 100 uds.";
    const rows=[
      makeGroup(name,100,9,"dentaltix","A",{stockStatus:"unknown"}),
      makeGroup(name,100,9,"dentalcost","B",{verificationSessionId:"other"}),
      makeGroup(name,100,9,"dentipak","C",{vatStatus:"unknown"}),
      makeGroup(name,100,9,"ortolan","D",{shippingCost:undefined,freeShippingThreshold:undefined}),
      makeGroup(name,100,9,"dentalboom","E",{sourceStatus:"quarantined"})
    ];
    const result=compareGloveAlternatives(rows,filters,"session-a");
    expect(result.ranked).toHaveLength(0);
    expect(result.unverified).toHaveLength(5);
  });
  it("excludes missing unit counts and contradictory specifications",()=>{
    const name="Guantes nitrilo talla M sin polvo no estériles";
    const g=makeGroup(name,1,10,"dentaltix","NOCOUNT",{quantity:undefined,unit:undefined});
    expect(compareGloveAlternatives([g],filters,"session-a").ranked).toHaveLength(0);
    const conflict=makeGroup("Guantes nitrilo talla M sin polvo no estériles 100 uds.",100,10,"dentaltix","CONFLICT",{
      rawName:"Guantes nitrilo talla L sin polvo no estériles 200 uds."
    });
    expect(mergedGloveProperties(conflict,conflict.offers[0]).conflicts.length).toBeGreaterThan(0);
    expect(compareGloveAlternatives([conflict],filters,"session-a").ranked).toHaveLength(0);
  });
  it("does not mix sterile and non-sterile gloves in one comparison",()=>{
    const a=makeGroup("Guantes nitrilo talla M sin polvo no estériles 100 uds.",100,10,"dentaltix","NON");
    const b=makeGroup("Guantes nitrilo talla M sin polvo estériles 100 uds.",100,8,"dentalcost","YES");
    const result=compareGloveAlternatives([a,b],filters,"session-a");
    expect(result.ranked.map(v=>v.reference)).toEqual(["NON"]);
  });
});
