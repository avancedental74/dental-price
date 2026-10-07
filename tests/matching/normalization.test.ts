import { describe, expect, it } from "vitest";
import {
  normalizeManufacturer,
  normalizeName,
  normalizePresentation,
  normalizeReference,
  normalizeShade,
  normalizeUnit
} from "../../src/domain/matching/normalization";

describe("normalization", () => {
  it("normalizes manufacturer names without inventing corporate equivalence", () => {
    expect(normalizeManufacturer("3M")).toBe("3m");
    expect(normalizeManufacturer("Solventum")).toBe("solventum");
  });

  it("normalizes grams", () => {
    expect(normalizeUnit("gr")).toBe("g");
    expect(normalizeUnit("gramos")).toBe("g");
  });

  it("normalizes presentations", () => {
    expect(normalizePresentation("Jeringa")).toBe("syringe");
    expect(normalizePresentation("cápsulas")).toBe("capsule");
  });

  it("preserves shade meaning while removing spacing", () => {
    expect(normalizeShade(" A 3.5 ")).toBe("A3.5");
  });

  it("normalizes manufacturer references", () => {
    expect(normalizeReference("4910-A3B")).toBe("4910A3B");
  });

  it("normalizes free text safely", () => {
    expect(normalizeName("Filtek  Supreme XTE, Jeringa 3 gramos"))
      .toBe("filtek supreme xte syringe 3 g");
  });
});
