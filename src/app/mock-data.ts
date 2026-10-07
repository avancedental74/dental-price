import type { CanonicalProduct, SupplierOffer } from "../types/domain";
import type { PriceObservation } from "../domain/history";

export const demoProduct:CanonicalProduct={
  id:"filtek-xte-a3-body-3g",manufacturer:"Solventum",brand:"Filtek",family:"Filtek Supreme XTE",productName:"Composite universal",variant:"Body",shade:"A3",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,manufacturerReference:"4910A3B",category:"Composites",normalizedName:"filtek supreme xte a3 body 3 g syringe",active:true
};

const now=new Date().toISOString();
export const demoOffers:SupplierOffer[]=[
  {supplierId:"dentaltix",supplierSku:"DTX-A3B",manufacturer:"Solventum",manufacturerReference:"4910A3B",rawName:"Filtek Supreme XTE A3 Body jeringa 3 g",normalizedName:"filtek supreme xte a3 body syringe 3 g solventum",productUrl:"https://www.dentaltix.com",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,variant:"Body",shade:"A3",stockStatus:"in_stock",regularPrice:39.9,vatStatus:"included",currency:"EUR",shippingCost:4.95,shippingCostVatIncluded:true,freeShippingThreshold:100,freeShippingThresholdBasis:"net",deliveryZone:"ES_PENINSULA",observedAt:now,sourceStatus:"normal"},
  {supplierId:"proclinic",supplierSku:"PRO-A3B",manufacturer:"Solventum",manufacturerReference:"4910A3B",rawName:"Filtek Supreme XTE A3 Body jeringa 3 g",normalizedName:"filtek supreme xte a3 body syringe 3 g solventum",productUrl:"https://www.proclinic.es",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,variant:"Body",shade:"A3",stockStatus:"in_stock",regularPrice:42,vatStatus:"included",currency:"EUR",shippingCost:0,shippingCostVatIncluded:true,freeShippingThreshold:110,freeShippingThresholdBasis:"net",deliveryZone:"ES_PENINSULA",promotion:{type:"buy_x_get_y",description:"3+1",minQty:3,freeQty:1},observedAt:now,sourceStatus:"normal"},
  {supplierId:"dental-iberica",supplierSku:"DI-A3B",manufacturer:"Solventum",manufacturerReference:"4910A3B",rawName:"Filtek Supreme XTE A3 Body jeringa 3 g",normalizedName:"filtek supreme xte a3 body syringe 3 g solventum",productUrl:"https://dentaliberica.com",presentation:"Jeringa",quantity:3,unit:"g",packCount:1,variant:"Body",shade:"A3",stockStatus:"in_stock",regularPrice:41.2,vatStatus:"included",currency:"EUR",shippingCost:5.9,shippingCostVatIncluded:true,freeShippingThreshold:120,freeShippingThresholdBasis:"net",deliveryZone:"ES_PENINSULA",observedAt:now,sourceStatus:"normal"}
];

export const demoHistory:PriceObservation[]=[
  ["2026-08-01T00:00:00.000Z",49.5],
  ["2026-08-20T00:00:00.000Z",47.9],
  ["2026-09-05T00:00:00.000Z",46.5],
  ["2026-09-20T00:00:00.000Z",44.9],
  ["2026-10-01T00:00:00.000Z",42.0],
  ["2026-10-06T00:00:00.000Z",39.9]
].map(([date,price],i)=>({id:"h"+i,productId:demoProduct.id,supplierId:"market",supplierSku:"market",observedAt:String(date),lastSeenAt:String(date),seenCount:1,requestedQuantity:1,regularPrice:Number(price),effectiveUnitCost:Number(price),effectiveTotalCost:Number(price),stockStatus:"in_stock",sourceUrl:"https://example.com"}));