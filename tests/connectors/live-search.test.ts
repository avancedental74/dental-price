import { describe, expect, it } from "vitest";
import { scoreLink } from "../../src/connectors/live-search";

describe("live search result scoring",()=>{
  it("rejects same-brand sibling products that miss a key model token",()=>{
    const exact=scoreLink(
      "Tetric EvoCeram Composite Universal Jeringa 3gr",
      "https://www.dentalcost.es/composites-universales/tetric-evoceram.html",
      "Tetric EvoCeram"
    );
    const evoflow=scoreLink(
      "Tetric EvoFlow Cavifil Composite Fluido",
      "https://www.dentalcost.es/composites-fluidos/tetric-evoflow.html",
      "Tetric EvoCeram"
    );
    const prime=scoreLink(
      "Tetric Prime Composite Universal Jeringa",
      "https://www.dentalcost.es/composites-universales/tetric-prime.html",
      "Tetric EvoCeram"
    );
    expect(exact).toBeGreaterThan(0);
    expect(evoflow).toBe(0);
    expect(prime).toBe(0);
  });

  it("strongly prefers an exact family phrase",()=>{
    const phrase=scoreLink(
      "Filtek Supreme XTE Composite Universal",
      "https://example.com/filtek-supreme-xte",
      "Filtek Supreme XTE"
    );
    const scattered=scoreLink(
      "Filtek Universal Composite - XTE compatible Supreme finish",
      "https://example.com/other-product",
      "Filtek Supreme XTE"
    );
    expect(phrase).toBeGreaterThan(scattered);
  });

  it("still scores exact manufacturer references",()=>{
    expect(scoreLink(
      "Filtek Supreme XTE A3 Body",
      "https://example.com/product",
      "4910A3B"
    )).toBe(0);
    expect(scoreLink(
      "Filtek Supreme XTE 4910A3B A3 Body",
      "https://example.com/product",
      "4910A3B"
    )).toBeGreaterThan(0);
  });
  it("does not confuse model suffixes such as Z250 and Z2500",()=>{
    expect(scoreLink("Composite Filtek Z250", "https://example.com/filtek-z250", "Z250")).toBeGreaterThan(0);
    expect(scoreLink("Composite Filtek Z2500", "https://example.com/filtek-z2500", "Z250")).toBe(0);
  });

  it("does not substitute a different shade when searching an exact shade token",()=>{
    expect(scoreLink("Tetric EvoCeram A3 Jeringa", "https://example.com/tetric-evoceram-a3", "Tetric EvoCeram A3")).toBeGreaterThan(0);
    expect(scoreLink("Tetric EvoCeram A3.5 Jeringa", "https://example.com/tetric-evoceram-a3-5", "Tetric EvoCeram A3")).toBe(0);
  });

  it("understands verbose supplier names with equivalent gram notation",()=>{
    expect(scoreLink(
      "Composite 3M Filtek Supreme XTE A3 Body Jeringa 3gr",
      "https://example.com/filtek-supreme-xte-a3-body",
      "Composite 3M Filtek Supreme A3 Body 3 g"
    )).toBeGreaterThan(0);
  });

  it("rejects a different package weight even for the same family and shade",()=>{
    expect(scoreLink(
      "Composite 3M Filtek Supreme XTE A3 Body 4 g",
      "https://example.com/filtek-supreme-xte-a3-body",
      "Composite 3M Filtek Supreme A3 Body 3 g"
    )).toBe(0);
  });

  it("rejects a different shade or variant in verbose queries",()=>{
    expect(scoreLink(
      "Composite 3M Filtek Supreme XTE A3.5 Dentin 3 g",
      "https://example.com/filtek-supreme-xte-a3-5",
      "Composite 3M Filtek Supreme A3 Body 3 g"
    )).toBe(0);
  });

  it("accepts only lexical synonyms, not different product variants",()=>{
    expect(scoreLink(
      "Resina compuesta Filtek Supreme A3 Body 3 gramos",
      "https://example.com/filtek-supreme-a3-body",
      "Composite Filtek Supreme A3 Body 3gr"
    )).toBeGreaterThan(0);
    expect(scoreLink(
      "Resina compuesta Filtek Supreme A3 Dentin 3 gramos",
      "https://example.com/filtek-supreme-a3-dentin",
      "Composite Filtek Supreme A3 Body 3gr"
    )).toBe(0);
  });

  it("supports Spanish shade wording without treating enamel as dentin",()=>{
    expect(scoreLink("Tetric EvoCeram Esmalte A3", "https://example.com/tetric-evoceram", "Tetric EvoCeram Enamel A3")).toBeGreaterThan(0);
    expect(scoreLink("Tetric EvoCeram Dentina A3", "https://example.com/tetric-evoceram", "Tetric EvoCeram Enamel A3")).toBe(0);
  });

  it("rejects reference echoes in URL query parameters",()=>{
    expect(scoreLink("Producto distinto", "https://example.com/product?search=4910A3B", "4910A3B")).toBe(0);
  });

  it("accepts an explicitly requested decimal shade written with a comma",()=>{
    expect(scoreLink(
      "Tetric EvoCeram Color - A3,5, Formato - Jeringa",
      "https://ortolan.es/es/odontologia/tetric-evoceram.html",
      "Tetric EvoCeram A3,5"
    )).toBeGreaterThan(0);
    expect(scoreLink(
      "Tetric EvoCeram Color - A3,5, Formato - Jeringa",
      "https://ortolan.es/es/odontologia/tetric-evoceram.html",
      "Tetric EvoCeram A3"
    )).toBe(0);
  });

});
