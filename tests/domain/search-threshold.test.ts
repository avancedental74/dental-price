import { describe, expect, it } from "vitest";
import type { CanonicalProduct } from "../../src/types/domain";
import { searchProducts } from "../../src/domain/search";
const p:CanonicalProduct={id:"p",manufacturer:"Solventum",family:"Filtek Supreme XTE",productName:"Composite",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,manufacturerReference:"4910A3B",category:"Composites",normalizedName:"filtek supreme xte",active:true};
describe("search safety threshold",()=>{
 it("does not surface unrelated weak matches",()=>expect(searchProducts([p],"alginato")).toEqual([]));
});