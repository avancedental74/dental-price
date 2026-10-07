import type { CanonicalProduct, SupplierOffer } from "../../types/domain";
export interface BasketRequestItem { product:CanonicalProduct; quantity:number; offers:SupplierOffer[]; }
export interface BasketAssignment { productId:string; quantity:number; supplierId:string; offer:SupplierOffer; lineGross:number; lineNet:number; }
export interface BasketSupplierSummary { supplierId:string; merchandiseGross:number; merchandiseNet:number; shipping:number; total:number; lines:number; }
export interface BasketOptimizationResult { total:number|null; assignments:BasketAssignment[]; suppliers:BasketSupplierSummary[]; missingProductIds:string[]; combinationsEvaluated:number; }