import type { SupplierOffer } from "../../types/domain";
export interface DvdVariantRaw { title:string;supplierSku?:string;manufacturerReference?:string;netPrice?:number;grossPrice?:number;stockText?:string;productUrl:string; }
export interface DvdProductRaw { title:string;manufacturer?:string;variants:DvdVariantRaw[];productUrl:string;promotionText?:string; }
export interface DvdConnectorResult { raw:DvdProductRaw;offers:SupplierOffer[]; }
export interface DvdHealth { status:"green"|"amber"|"red";checkedAt:string;message:string; }
