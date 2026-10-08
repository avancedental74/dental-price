import {describe,it,expect} from "vitest";
import {describe as describeGlove,matches} from "../../src/components/VisualSearchResults";
import type {LiveSearchGroup} from "../../src/services/live-prices";

function group(family:string):LiveSearchGroup{
  return {id:family,label:family,offers:[],product:{
    id:family,family,productName:family,manufacturer:"",presentation:"Caja",
    quantity:100,unit:"unit",packCount:1,category:"Búsqueda live",
    normalizedName:family.toLowerCase(),active:true
  }};
}

describe("visual glove search",()=>{
  it("extracts material, size, powder and units without selecting a SKU",()=>{
    const item=describeGlove(group("Guantes de nitrilo sin polvo azules Talla M 100 uds."));
    expect(item.properties.material).toBe("Nitrilo");
    expect(item.properties.powder).toBe("Sin polvo");
    expect(item.properties.size).toBe("M");
    expect(item.properties.units).toBe("100");
    expect(matches(item,{material:"Nitrilo",size:"M"})).toBe(true);
    expect(matches(item,{material:"Látex"})).toBe(false);
  });
  it("does not imply sterile when evidence is missing",()=>{
    expect(describeGlove(group("Guantes látex sin polvo")).properties.sterile).toBeUndefined();
  });
  it("separates sterile and non sterile",()=>{
    expect(describeGlove(group("Guantes de látex estériles Nº 7")).type).toBe("Estériles");
    expect(describeGlove(group("Guantes de látex no estériles Nº 7")).properties.sterile).toBe("No estériles");
  });
  it("does not invent filters for unrelated products",()=>{
    expect(describeGlove(group("Composite Filtek Supreme A3")).properties).toEqual({});
  });
});