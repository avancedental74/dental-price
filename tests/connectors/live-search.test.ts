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
});
