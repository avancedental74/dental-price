import type { SupplierOffer } from "../../types/domain";

export interface DentalIbericaVariantRaw {
  title: string;
  supplierSku?: string;
  manufacturerReference?: string;
  price?: number;
  rawStockText?: string;
  productUrl: string;
}

export interface DentalIbericaProductRaw {
  title: string;
  manufacturer?: string;
  contentText?: string;
  pageManufacturerReference?: string;
  rawStockText?: string;
  productUrl: string;
  variants: DentalIbericaVariantRaw[];
}

export interface DentalIbericaHealth {
  status: "green" | "amber" | "red";
  checkedAt: string;
  message: string;
}

export interface DentalIbericaConnectorResult {
  raw: DentalIbericaProductRaw;
  offers: SupplierOffer[];
}