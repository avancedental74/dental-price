import { describe, expect, it } from "vitest";
import type { CanonicalProduct, SupplierOffer } from "../../src/types/domain";
import { matchOfferToProduct } from "../../src/domain/matching/matcher";

const product: CanonicalProduct = {
  id: "p-filtek-a3-body",
  manufacturer: "Solventum",
  brand: "Filtek",
  family: "Filtek Supreme XTE",
  productName: "Composite universal",
  variant: "Body",
  shade: "A3",
  presentation: "Jeringa",
  quantity: 3,
  unit: "g",
  packCount: 1,
  manufacturerReference: "4910A3B",
  category: "Composites",
  normalizedName: "filtek supreme xte a3 body 3 g jeringa",
  active: true
};

function offer(overrides: Partial<SupplierOffer> = {}): SupplierOffer {
  return {
    supplierId: "supplier-x",
    supplierSku: "SKU-1",
    manufacturer: "Solventum",
    manufacturerReference: "4910A3B",
    rawName: "Filtek Supreme XTE A3 Body jeringa 3 g Solventum",
    normalizedName: "filtek supreme xte a3 body syringe 3 g solventum",
    productUrl: "https://example.com/product",
    presentation: "Jeringa",
    quantity: 3,
    unit: "g",
    packCount: 1,
    variant: "Body",
    shade: "A3",
    stockStatus: "in_stock",
    regularPrice: 39.9,
    vatStatus: "included",
    currency: "EUR",
    observedAt: "2026-10-07T08:00:00.000Z",
    sourceStatus: "normal",
    ...overrides
  };
}

describe("matchOfferToProduct", () => {
  it("matches the same manufacturer reference and compatible presentation", () => {
    const result = matchOfferToProduct(product, offer());
    expect(result.status).toBe("EXACT");
    expect(result.hardReject).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("rejects A3.5 when canonical shade is A3", () => {
    const result = matchOfferToProduct(product, offer({ shade: "A3.5" }));
    expect(result.status).toBe("REJECTED");
    expect(result.conflicts).toContain("Tono/color contradictorio");
  });

  it("rejects Dentin when canonical variant is Body", () => {
    const result = matchOfferToProduct(product, offer({ variant: "Dentin" }));
    expect(result.status).toBe("REJECTED");
    expect(result.conflicts).toContain("Variante contradictoria");
  });

  it("rejects capsules when canonical presentation is syringe", () => {
    const result = matchOfferToProduct(product, offer({ presentation: "Cápsulas" }));
    expect(result.status).toBe("REJECTED");
    expect(result.conflicts).toContain("Presentación contradictoria");
  });

  it("rejects a different weight", () => {
    const result = matchOfferToProduct(product, offer({ quantity: 4 }));
    expect(result.status).toBe("REJECTED");
    expect(result.conflicts).toContain("Cantidad o unidad incompatible");
  });

  it("rejects a different pack count", () => {
    const result = matchOfferToProduct(product, offer({ packCount: 20 }));
    expect(result.status).toBe("REJECTED");
    expect(result.conflicts).toContain("Pack incompatible");
  });

  it("rejects contradictory manufacturer references", () => {
    const result = matchOfferToProduct(
      product,
      offer({ manufacturerReference: "SOMETHING-ELSE" })
    );
    expect(result.status).toBe("REJECTED");
    expect(result.conflicts).toContain("Referencia de fabricante contradictoria");
  });
});
