import { describe, expect, it } from "vitest";
import { canonicalProductSchema } from "../../src/domain/schemas";

describe("canonicalProductSchema", () => {
  it("accepts a valid canonical product", () => {
    const parsed = canonicalProductSchema.parse({
      id: "p1",
      manufacturer: "Solventum",
      family: "Filtek Supreme XTE",
      productName: "Composite universal",
      presentation: "Jeringa",
      quantity: 3,
      unit: "g",
      packCount: 1,
      category: "Composites",
      normalizedName: "filtek supreme xte",
      active: true
    });
    expect(parsed.id).toBe("p1");
  });

  it("rejects zero quantity", () => {
    expect(() =>
      canonicalProductSchema.parse({
        id: "p1",
        manufacturer: "X",
        family: "Y",
        productName: "Z",
        presentation: "Unidad",
        quantity: 0,
        unit: "ud",
        packCount: 1,
        category: "Test",
        normalizedName: "z",
        active: true
      })
    ).toThrow();
  });
});
