import {describe,it,expect} from "vitest";
import type {CanonicalProduct,SupplierOffer} from "../../src/types/domain";
import type {LiveSearchGroup} from "../../src/services/live-prices";
import {
  inferProfile,profileForSearch,extractSpecs,specsForGroup,assessProducts,
  assessAlternatives,getAvailableFacets,filterProducts
} from "../../src/features/search/universal";
const now=()=>new Date().toISOString();
function group(id:string,name:string,price=20,quantity=100,opts:Partial<SupplierOffer>={}):LiveSearchGroup{
  const product:CanonicalProduct={
    id,manufacturer:"Marca "+id,family:name,productName:name,
    presentation:"Caja",quantity,unit:"unit",packCount:1,
    manufacturerReference:id,category:"Búsqueda live",
    normalizedName:name.toLowerCase(),active:true
  };
  const offer:SupplierOffer={
    supplierId:"dentaltix",supplierSku:id,manufacturer:product.manufacturer,manufacturerReference:id,
    rawName:name,normalizedName:name.toLowerCase(),productUrl:"https://example.com/"+id,
    presentation:"Caja",quantity,unit:"unit",packCount:1,
    stockStatus:"in_stock",regularPrice:price,
    vatStatus:"excluded",vatRate:21,currency:"EUR",
    shippingCost:4,shippingCostVatIncluded:true,shippingPolicyObservedAt:now(),
    observedAt:now(),verifiedAt:now(),sourceStatus:"normal",sourceMode:"automatic",
    verificationKind:"live",verificationSessionId:"live1",...opts
  };
  return {
    id,label:name,manufacturerReference:id,
    identityLevel:"exact_identity",identityReasons:["Referencia de fabricante acreditada"],
    product,offers:[offer]
  };
}
describe("universal dental price comparison",()=>{
  it("uses the same category detection interface for any dental search",()=>{
    expect(["Guantes de nitrilo","Composite Filtek Supreme","Fresas diamantadas","Implantes cónicos","Cemento resinoso","Anestesia articaina","Gasa hemostática"].map(inferProfile))
      .toEqual(["gloves","composite","burs","implants","cement","anesthetic","general"]);
    expect(profileForSearch("filtek supreme",[])).toBe("composite");
  });
  it("extracts attributes but does not guess undocumented ones",()=>{
    expect(extractSpecs("Guantes nitrilo talla M sin polvo no estériles caja 100 uds.")).toMatchObject({
      material:"Nitrilo",size:"M",powder:"Sin polvo",sterile:"No estéril",quantity:"100 ud"
    });
    expect(extractSpecs("Composite Filtek A3 jeringa 3 g")).toMatchObject({
      shade:"A3",presentation:"Jeringa",quantity:"3 g"
    });
    expect(extractSpecs("Limas manuales K nº 15").sterile).toBeUndefined();
  });
  it("ranks verified prices per exact product for any product type",()=>{
    const g=group("C001","Composite de prueba",18);
    const assessed=assessProducts([g],"live1");
    expect(assessed[0].best?.effectiveTotal).toBeCloseTo(25.78,2);
    expect(assessed[0].best?.eligible).toBe(true);
  });
  it("does not create a global cheapest product from different clinical items",()=>{
    const composite=group("CO","Composite jeringa A3",50);
    const implants=group("IM","Implante titanio 3.5 x 10",10);
    const products=assessProducts([composite,implants],"live1");
    expect(products).toHaveLength(2);
    const alternatives=assessAlternatives(products,{},"general");
    expect(alternatives.ranked).toHaveLength(0);
    expect(alternatives.unverified).toHaveLength(2);
  });
  it("offers dynamic filters beyond gloves, with strict per-offer conjunction",()=>{
    const a=group("X","Composite jeringa A3 3 g",18,3,{
      presentation:"Jeringa",unit:"g",quantity:3
    });
    const b=group("Y","Composite cápsulas A2 2 g",19,2,{
      presentation:"Cápsulas",unit:"g",quantity:2
    });
    const products=assessProducts([a,b],"live1");
    const facets=getAvailableFacets(products);
    expect(facets.find(f=>f.key==="shade")?.values.map(v=>v.value)).toContain("A3");
    expect(filterProducts(products,{shade:"A3"})).toHaveLength(1);
    expect(filterProducts(products,{shade:"A3",presentation:"Cápsulas"})).toHaveLength(0);
  });
  it("does not rank unverified prices or different live sessions",()=>{
    const g=group("G1","Guantes nitrilo talla M sin polvo no estériles 100 uds.",7,100,{
      verificationSessionId:"prior"
    });
    const products=assessProducts([g],"live1");
    expect(products[0].best).toBeUndefined();
    const selected={material:"Nitrilo",size:"M",powder:"Sin polvo",sterile:"No estéril"};
    expect(assessAlternatives(products,selected,"gloves").ranked).toHaveLength(0);
  });
  it("normalizes cost only within fully specified and verified comparable category",()=>{
    const a=group("G100","Guantes nitrilo talla M sin polvo no estériles 100 uds.",20,100);
    const b=group("G200","Guantes nitrilo talla M sin polvo no estériles 200 uds.",32,200);
    const products=assessProducts([a,b],"live1");
    const alt=assessAlternatives(products,{material:"Nitrilo",size:"M",powder:"Sin polvo",sterile:"No estéril"},"gloves");
    expect(alt.ranked).toHaveLength(2);
    expect(alt.ranked[0].normalizedCost).toBeCloseTo(21.36,2);
    expect(alt.ranked[0].normalizedBasis).toBe("100 ud");
  });
  it("excludes incompatible categories from alternative ranking",()=>{
    const g=group("G1","Guantes nitrilo talla M sin polvo no estériles 100 uds.",12);
    const c=group("C1","Composite dental talla M sin polvo no estériles 100 uds.",2);
    const specs={material:"Nitrilo",size:"M",powder:"Sin polvo",sterile:"No estéril"};
    expect(assessAlternatives(assessProducts([g,c],"live1"),specs,"gloves").ranked.map(a=>a.groupId)).toEqual(["G1"]);
    expect(assessAlternatives(assessProducts([g],"live1"),{},"gloves").ranked).toHaveLength(0);
  });
  it("flags pack quantity disagreements, never borrowing missing count from a different supplier",()=>{
    const g=group("MIS","Guantes nitrilo talla M sin polvo no estériles 100 uds.",10,200);
    expect(specsForGroup(g,g.offers[0]).conflicts).toContain("Cantidad contradictoria");
    expect(assessProducts([g],"live1")[0].best).toBeUndefined();
    const missing=group("NONE","Guantes nitrilo talla M sin polvo no estériles 100 uds.",10,100,{
      quantity:undefined,unit:undefined
    });
    expect(assessProducts([missing],"live1")[0].offers[0].normalizedCost).toBeUndefined();
  });
  it("does not invent normalized cost for a multi-pack measured per capsule",()=>{
    const multi=group("CAP20","Composite A3 0.2 g",38,0.2,{
      quantity:0.2,unit:"g",packCount:20,presentation:"Cápsulas"
    });
    multi.product.packCount=20;
    multi.product.unit="g";
    multi.product.presentation="Cápsulas";
    const result=assessProducts([multi],"live1");
    expect(result[0].best?.eligible).toBe(true);
    expect(result[0].offers[0].normalizedCost).toBeUndefined();
    expect(result[0].offers[0].effectiveTotal).toBeGreaterThan(0);
  });

  it("normalizes package quantities regardless of whitespace",()=>{
    expect(extractSpecs("Alginato 500g").quantity).toBe("500 g");
    expect(extractSpecs("Alginato 500 g").quantity).toBe("500 g");
    expect(extractSpecs("Alginato 453gr").quantity).toBe("453 g");
    expect(extractSpecs("Alginato 453 g").quantity).toBe("453 g");
  });
  it("never presents a search-index price as a verified purchase price",()=>{
    const entry=group("D001","Alginato de impresión 500g",9.24,500,{
      unit:"g",quantity:500,priceVerification:"search_index"
    });
    const result=assessProducts([entry],"live1");
    expect(result[0].best).toBeUndefined();
    expect(result[0].offers[0].eligible).toBe(false);
    expect(result[0].offers[0].issues.join(" ")).toContain("no comprobado en la ficha");
    expect(result[0].offers[0].priceVerification).toBe("search_index");
  });

});
