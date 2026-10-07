import type { SupplierOffer } from "../../types/domain";

export interface DentaltixVariantRaw {
  title: string;
  supplierSku?: string;
  manufacturerReference?: string;
  regularPrice?: number;
  salePrice?: number;
  rawStockText?: string;
  productUrl: string;
}

export interface DentaltixProductRaw {
  title: string;
  manufacturer?: string;
  pageSupplierSku?: string;
  pageManufacturerReference?: string;
  regularPrice?: number;
  salePrice?: number;
  vatIncludedPrice?: number;
  vatRate?: number;
  vatIncluded?: boolean;
  rawStockText?: string;
  productUrl: string;
  promotionText?: string;
  variants: DentaltixVariantRaw[];
}

export interface DentaltixHealth {
  status: "green" | "amber" | "red";
  checkedAt: string;
  message: string;
}

export interface DentaltixConnectorResult {
  raw: DentaltixProductRaw;
  offers: SupplierOffer[];
}