import { describe, expect, it } from "vitest";
import type { CanonicalProduct } from "../../src/types/domain";
import { searchProducts } from "../../src/domain/search";
const base=(id:string,family:string,ref:string,shade:string):CanonicalProduct=>({id,manufacturer:"Solventum",family,productName:"Composite",shade,presentation:"Jeringa",quantity:4,unit:"g",packCount:1,manufacturerReference:ref,category:"Composites",normalizedName:(family+" "+shade+" jeringa 4 g").toLowerCase(),active:true});
const products=[base("xte","Filtek Supreme XTE","4910A3B","A3"),base("z250","Filtek Z250","6020A3","A3"),base("universal","Filtek Universal Restorative","6555A3","A3")];
describe("product search",()=>{
 it("returns one exact reference first",()=>{const r=searchProducts(products,"6020A3"); expect(r[0].product.id).toBe("z250"); expect(r[0].exactReference).toBe(true);});
 it("returns multiple candidates for ambiguous filtek a3",()=>{const r=searchProducts(products,"filtek a3"); expect(r.length).toBeGreaterThan(1);});
});