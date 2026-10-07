import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDentalIbericaProductHtml } from "../../src/connectors/dental-iberica/parser";
import { normalizeDentalIberica } from "../../src/connectors/dental-iberica/normalizer";
const here=dirname(fileURLToPath(import.meta.url));
const filtek=readFileSync(resolve(here,"../../fixtures/dental-iberica/filtek-z250.html"),"utf8");
const air=readFileSync(resolve(here,"../../fixtures/dental-iberica/air-n-go.html"),"utf8");
const peeso=readFileSync(resolve(here,"../../fixtures/dental-iberica/peeso.html"),"utf8");

describe("Dental Iberica connector",()=>{
  it("extracts independent Filtek shade variants and stock",()=>{
    const raw=parseDentalIbericaProductHtml(filtek,"https://dentaliberica.com/demo-filtek");
    expect(raw.title).toContain("FILTEK Z250");
    expect(raw.manufacturer).toBe("3M");
    expect(raw.variants).toHaveLength(4);
    expect(raw.variants[0].supplierSku).toBe("3M130");
    expect(raw.variants[0].manufacturerReference).toBe("6021A1");
    expect(raw.variants[3].rawStockText).toBe("Sin stock");
  });

  it("normalizes shades including decimal comma and keeps unavailable variants",()=>{
    const offers=normalizeDentalIberica(parseDentalIbericaProductHtml(filtek,"https://dentaliberica.com/demo-filtek"));
    expect(offers.map(o=>o.shade)).toEqual(["A1","A3","A3.5","B3"]);
    expect(offers[3].stockStatus).toBe("unavailable");
    expect(offers[0].packCount).toBe(20);
    expect(offers[0].quantity).toBe(0.2);
    expect(offers[0].unit).toBe("g");
  });

  it("keeps AIR-N-GO flavours as distinct variants",()=>{
    const offers=normalizeDentalIberica(parseDentalIbericaProductHtml(air,"https://dentaliberica.com/demo-air"));
    expect(offers.map(o=>o.variant)).toEqual(["Limón","Cola","Menta"]);
    expect(offers.map(o=>o.manufacturerReference)).toEqual(["F10251","F10253","F10250"]);
  });

  it("keeps Peeso sizes as distinct numbered variants",()=>{
    const offers=normalizeDentalIberica(parseDentalIbericaProductHtml(peeso,"https://dentaliberica.com/demo-peeso"));
    expect(offers.map(o=>o.variant)).toEqual(["No2","No1","No3"]);
    expect(offers.every(o=>o.packCount===6)).toBe(true);
    expect(offers.every(o=>o.quantity===28 && o.unit==="mm")).toBe(true);
  });

  it("does not invent VAT information",()=>{
    const offers=normalizeDentalIberica(parseDentalIbericaProductHtml(filtek,"https://dentaliberica.com/demo-filtek"));
    expect(offers[0].vatStatus).toBe("unknown");
    expect(offers[0].vatRate).toBeUndefined();
  });
});