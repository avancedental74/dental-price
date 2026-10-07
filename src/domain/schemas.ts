import { z } from "zod";

export const canonicalProductSchema = z.object({
  id: z.string().min(1),
  manufacturer: z.string().min(1),
  brand: z.string().optional(),
  family: z.string().min(1),
  productName: z.string().min(1),
  variant: z.string().optional(),
  shade: z.string().optional(),
  presentation: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  packCount: z.number().int().positive(),
  manufacturerReference: z.string().optional(),
  eanGtin: z.string().optional(),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  normalizedName: z.string().min(1),
  active: z.boolean()
});

export const promotionSchema = z.object({
  type: z.enum(["percentage_discount","fixed_discount","buy_x_get_y","bundle","liquidation","coupon_public","free_shipping","other"]),
  description: z.string().min(1),
  minQty: z.number().int().positive().optional(),
  freeQty: z.number().int().positive().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().nonnegative().optional(),
  bundlePrice: z.number().nonnegative().optional(),
  validUntil: z.string().optional()
});

export const supplierOfferSchema = z.object({
  supplierId: z.string().min(1),
  supplierSku: z.string().optional(),
  manufacturer: z.string().optional(),
  manufacturerReference: z.string().optional(),
  eanGtin: z.string().optional(),
  rawName: z.string().min(1),
  normalizedName: z.string().min(1),
  productUrl: z.string().url(),
  presentation: z.string().optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  packCount: z.number().int().positive().optional(),
  variant: z.string().optional(),
  shade: z.string().optional(),
  stockStatus: z.enum(["in_stock","low_stock","backorder","preorder","unavailable","unknown"]),
  rawStockText: z.string().optional(),
  regularPrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative().optional(),
  vatStatus: z.enum(["included","excluded","unknown"]),
  vatRate: z.number().nonnegative().optional(),
  currency: z.literal("EUR"),
  promotion: promotionSchema.optional(),
  shippingCost: z.number().nonnegative().optional(),
  shippingCostVatIncluded: z.boolean().optional(),
  shippingVatRate: z.number().nonnegative().optional(),
  freeShippingThreshold: z.number().nonnegative().optional(),
  freeShippingThresholdBasis: z.enum(["net","gross"]).optional(),
  shippingPolicyObservedAt: z.string().datetime().optional(),
  shippingPolicySourceUrl: z.string().url().optional(),
  deliveryZone: z.enum(["ES_PENINSULA","ES_BALEARES","ES_CANARIAS","ES_CEUTA_MELILLA","OTHER"]).optional(),
  deliveryEstimate: z.string().optional(),
  observedAt: z.string().datetime(),
  sourceStatus: z.enum(["normal","suspicious","quarantined"]),
  sourceMode: z.enum(["automatic","manual"]).optional()
});