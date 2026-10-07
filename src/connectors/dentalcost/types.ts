import type { SupplierOffer } from "../../types/domain";

export interface DentalCostVariantRaw {
  title:string;
  supplierSku?:string;
  manufacturerReference?:string;
  stockText?:string;
  price?:number;
  productUrl:string;
  promotionText?:string;
}
export interface DentalCostProductRaw {
  title:string;
  manufacturer?:string;
  vatRate?:number;
  regularPrice?:number;
  salePrice?:number;
  variants:DentalCostVariantRaw[];
  productUrl:string;
  promotionText?:string;
}
export interface DentalCostConnectorResult { raw:DentalCostProductRaw; offers:SupplierOffer[]; }
export interface DentalCostHealth { status:"green"|"amber"|"red"; checkedAt:string; message:string; }
