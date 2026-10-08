import {describe,expect,it} from "vitest";
import type {MatchedSupplierOffer} from "../../src/domain/comparison/types";
import type {CanonicalProduct,SupplierOffer} from "../../src/types/domain";
import {sortComparisonItems} from "../../src/components/ComparisonTable";

const product:CanonicalProduct={
  id:"P",manufacturer:"Maker",family:"Producto",productName:"Producto",
  presentation:"Caja",quantity:1,unit:"unit",packCount:1,
  manufacturerReference:"REF",category:"Dental",normalizedName:"producto",active:true
};

function item(supplierId:string,overrides:Partial<SupplierOffer>,eligible=false,total?:number):MatchedSupplierOffer{
  const offer:SupplierOffer={
    supplierId,supplierSku:supplierId,manufacturer:"Maker",manufacturerReference:"REF",
    rawName:"Producto REF",normalizedName:"producto ref",productUrl:"https://example.com/"+supplierId,
    stockStatus:"in_stock",regularPrice:10,vatStatus:"excluded",vatRate:21,
    currency:"EUR",observedAt:"2026-10-08T10:00:00.000Z",sourceStatus:"normal",
    priceVerification:"detail",verificationKind:"live",verificationSessionId:"s",verifiedAt:"2026-10-08T10:00:00.000Z",
    ...overrides
  };
  return {
    product,offer,
    match:{status:"EXACT",score:100,hardReject:false,reasons:[],conflicts:[],canonicalProductId:product.id,supplierId,supplierSku:supplierId},
    pricing:total===undefined?null:{
      supplierId,requestedQuantity:1,paidUnits:1,receivedUnits:1,baseUnitPrice:10,
      subtotalBeforeVat:10,discountAmount:0,promotionalSubtotal:10,vatAmount:2.1,
      subtotalWithVat:12.1,shippingCost:0,effectiveUnitCost:total,effectiveTotalCost:total,warnings:[]
    },
    eligibleForRanking:eligible
  };
}

describe("sortable comparison table model",()=>{
  it("keeps ranking-safe offers ahead of unverified index prices by reliability",()=>{
    const exact=item("dentaltix",{},true,12);
    const index=item("dvd-dental",{priceVerification:"search_index",sourceStatus:"suspicious"},false);
    const detail=item("dentalcost",{},false,11);
    expect(sortComparisonItems([index,detail,exact],"reliability").map(x=>x.offer.supplierId))
      .toEqual(["dentaltix","dentalcost","dvd-dental"]);
  });

  it("sorts by effective total without using search-index prices as totals",()=>{
    const high=item("dentaltix",{},true,30);
    const low=item("dentalcost",{},true,20);
    const index=item("dvd-dental",{salePrice:1,priceVerification:"search_index"},false);
    expect(sortComparisonItems([high,index,low],"effectiveTotal").map(x=>x.offer.supplierId))
      .toEqual(["dentalcost","dentaltix","dvd-dental"]);
  });
});
