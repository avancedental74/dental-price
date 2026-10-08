import {describe,it,expect,vi,afterEach} from "vitest";
import worker from "../../worker/live-api";
afterEach(()=>vi.unstubAllGlobals());
describe("lightweight supplier indexing under low Worker resources",()=>{
 it("returns the WooCommerce amount without fetching heavyweight product HTML",async()=>{
  const fetchMock=vi.fn(async(input:RequestInfo|URL)=>{
   const url=String(input);
   if(url.includes("/wp-json/wc/store/v1/products"))return Response.json([{
     sku:"G001",name:"Guantes nitrilo sin polvo",
     permalink:"https://dentalboom.com/product/guantes-nitrilo/",
     prices:{price:"899",regular_price:"999",currency_minor_unit:2},
     is_in_stock:true
   }]);
   throw new Error("Product details should not be fetched for a generic search");
  });
  vi.stubGlobal("fetch",fetchMock);
  const req=new Request("https://worker.test/search-supplier?q=guantes&supplier=dentalboom&sessionId=lightweight");
  const response=await worker.fetch(req,{});
  const data=await response.json() as {offers:Array<{salePrice?:number;regularPrice:number;priceVerification:string;sourceStatus:string}>;error:string|null};
  expect(response.status).toBe(200);
  expect(data.error).toBeNull();
  expect(data.offers).toHaveLength(1);
  expect(data.offers[0].salePrice).toBe(8.99);
  expect(data.offers[0].regularPrice).toBe(9.99);
  expect(data.offers[0].priceVerification).toBe("search_index");
  expect(data.offers[0].sourceStatus).not.toBe("normal");
  expect(fetchMock).toHaveBeenCalledTimes(1);
 });
});