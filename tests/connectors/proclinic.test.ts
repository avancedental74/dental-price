import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseProclinicProductHtml } from "../../src/connectors/proclinic/parser";
import { normalizeProclinic } from "../../src/connectors/proclinic/normalizer";
const here=dirname(fileURLToPath(import.meta.url));
const filtek=readFileSync(resolve(here,"../../fixtures/proclinic/filtek-supreme-xte.html"),"utf8");
const gloves=readFileSync(resolve(here,"../../fixtures/proclinic/nitrile-gloves.html"),"utf8");

describe("Proclinic connector",()=>{
  it("extracts Filtek pricing, shipping threshold and variant identifiers",()=>{
    const raw=parseProclinicProductHtml(filtek,"https://www.proclinic.es/demo");
    expect(raw.title).toBe("FILTEK SUPREME XTE JERINGA");
    expect(raw.manufacturer).toBe("SOLVENTUM");
    expect(raw.salePrice).toBe(48.39);
    expect(raw.regularPrice).toBe(73.63);
    expect(raw.vatIncludedPrice).toBe(53.23);
    expect(raw.freeShippingThreshold).toBe(110);
    expect(raw.variants).toHaveLength(1);
    expect(raw.variants[0].manufacturerReference).toBe("4910B2B");
  });

  it("infers VAT rate from explicit net and gross prices instead of hardcoding it",()=>{
    const offers=normalizeProclinic(parseProclinicProductHtml(filtek,"https://www.proclinic.es/demo"));
    expect(offers[0].vatStatus).toBe("excluded");
    expect(offers[0].vatRate).toBeCloseTo(10,1);
  });

  it("keeps glove sizes as different variants",()=>{
    const offers=normalizeProclinic(parseProclinicProductHtml(gloves,"https://www.proclinic.es/gloves"));
    expect(offers).toHaveLength(3);
    expect(offers.map(o=>o.variant)).toEqual(["Talla XS","Talla S","Talla M"]);
    expect(offers.map(o=>o.manufacturerReference)).toEqual(["GLOBN51-AKZ-BK-XS1","GLOBN51-AKZ-BK-S01","GLOBN51-AKZ-BK-M01"]);
  });
});