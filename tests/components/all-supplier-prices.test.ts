import {describe,expect,it} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {CanonicalProduct,SupplierOffer} from "../../src/types/domain";
import type {LiveSearchGroup} from "../../src/services/live-prices";
import {assessProducts} from "../../src/features/search/universal";
import {collectPublishedPrices} from "../../src/features/search/published-prices";
import {AllSupplierPrices} from "../../src/components/AllSupplierPrices";
const now=new Date().toISOString();
function group():LiveSearchGroup{
 const name="Alginato 500 g";
 const product:CanonicalProduct={id:"A",manufacturer:"",family:name,productName:name,presentation:"",quantity:0,unit:"",packCount:0,category:"Búsqueda live",normalizedName:name.toLowerCase(),active:true};
 const suppliers=["dentipak","dvd-dental","ortolan","dentaltix"];
 const prices=[10,9.24,8.9,11.6];
 const offers:SupplierOffer[]=suppliers.map((supplierId,i)=>({supplierId,supplierSku:"SKU-"+i,rawName:name,normalizedName:name.toLowerCase(),productUrl:"https://example.com/"+i,regularPrice:prices[i]!,stockStatus:"unknown",vatStatus:"unknown",currency:"EUR",observedAt:now,sourceStatus:i===1||i===2?"suspicious":"normal",priceVerification:i===1||i===2?"search_index":"detail",verificationKind:"live",verificationSessionId:"latest"}));
 return {id:"A",label:name,product,offers};
}
describe("complete price visibility",()=>{
 it("shows every recovered supplier even without checkout verification",()=>{
   const rows=collectPublishedPrices(assessProducts([group()],"latest"));
   expect(rows).toHaveLength(4);
   expect(rows.every(r=>r.offer.effectiveTotal===undefined)).toBe(true);
   const html=renderToStaticMarkup(createElement(AllSupplierPrices,{rows}));
   for(const text of ["Dentipak","DVD Dental","Ortolan","Dentaltix","9,24","8,90","Índice del proveedor"])expect(html).toContain(text);
 });
 it("allows an advertised number while preserving ranking safeguards",()=>{
   const rows=collectPublishedPrices(assessProducts([group()],"latest"));
   const index=rows.find(row=>row.offer.supplierId==="dvd-dental")!;
   expect(index.offer.publishedPrice).toBe(9.24);
   expect(index.offer.eligible).toBe(false);
 });
});