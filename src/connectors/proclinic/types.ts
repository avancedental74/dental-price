import type { SupplierOffer } from "../../types/domain";

export interface ProclinicVariantRaw {
  title: string;
  supplierSku?: string;
  manufacturerReference?: string;
  regularPrice?: number;
  salePrice?: number;
  vatIncludedPrice?: number;
  rawStockText?: string;
  productUrl: string;
}

export interface ProclinicProductRaw {
  title: string;
  manufacturer?: string;
  contentText?: string;
  pageSupplierSku?: string;
  pageManufacturerReference?: string;
  regularPrice?: number;
  salePrice?: number;
  vatIncludedPrice?: number;
  rawStockText?: string;
  freeShippingThreshold?: number;
  productUrl: string;
  variants: ProclinicVariantRaw[];
}

export interface ProclinicHealth {
  status: "green" | "amber" | "red";
  checkedAt: string;
  message: string;
}

export interface ProclinicConnectorResult {
  raw: ProclinicProductRaw;
  offers: SupplierOffer[];
}