import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseDentaltixProductHtml } from "../../src/connectors/dentaltix/parser";
import { normalizeDentaltix } from "../../src/connectors/dentaltix/normalizer";

const here = dirname(fileURLToPath(import.meta.url));
const filtek = readFileSync(resolve(here, "../../fixtures/dentaltix/filtek-supreme-xte.html"), "utf8");
const gloves = readFileSync(resolve(here, "../../fixtures/dentaltix/nitrile-gloves.html"), "utf8");

describe("Dentaltix connector", () => {
  it("extracts product metadata and variants from Filtek fixture", () => {
    const raw = parseDentaltixProductHtml(filtek, "https://www.dentaltix.com/demo");
    expect(raw.title).toContain("Filtek Supreme XTE");
    expect(raw.manufacturer).toBe("Solventum");
    expect(raw.variants).toHaveLength(2);
    expect(raw.variants[0].manufacturerReference).toBe("4910A1B");
  });

  it("normalizes Filtek variants separately", () => {
    const offers = normalizeDentaltix(parseDentaltixProductHtml(filtek, "https://www.dentaltix.com/demo"));
    expect(offers).toHaveLength(2);
    expect(offers[0].presentation).toBe("Jeringa");
    expect(offers[0].quantity).toBe(3);
    expect(offers[0].unit).toBe("g");
    expect(offers[0].variant).toBe("Body");
    expect(offers[0].shade).toBe("A1");
  });

  it("preserves glove variants as distinct references", () => {
    const raw = parseDentaltixProductHtml(gloves, "https://www.dentaltix.com/demo-gloves");
    expect(raw.variants).toHaveLength(3);
    expect(raw.variants.map(v => v.manufacturerReference)).toEqual(["003642","003659","003666"]);
  });
});