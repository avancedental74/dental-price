import {describe,it,expect,vi,afterEach} from "vitest";
import worker from "../../worker/live-api";
afterEach(()=>vi.unstubAllGlobals());
describe("Worker: candidate detail failure is not no-match",()=>{
 it("returns an error when a supplier exposes a product listing but its detail cannot be parsed",async()=>{
  vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL)=>{
   const url=String(input);
   if(url.includes("/wp-json/wc/store/v1/products")){
    return Response.json([{sku:"G001",name:"Guantes nitrilo sin polvo",permalink:"https://dentalboom.com/product/guantes-nitrilo/"}]);
   }
   return new Response("<html><body>Product page unavailable</body></html>",{status:503});
  }));
  const req=new Request("https://worker.test/search-supplier?q=guantes&supplier=dentalboom&sessionId=test-zero");
  const response=await worker.fetch(req,{});
  expect(response.status).toBe(200);
  const result=await response.json() as {offers:unknown[];error:string|null;noMatch:boolean};
  expect(result.offers).toHaveLength(0);
  expect(result.error).toBe("PRODUCT_DETAILS_UNVERIFIED");
  expect(result.noMatch).toBe(false);
 });
});