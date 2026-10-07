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

  it("parses selected modern Dentaltix SKU without contaminating references or double VAT", () => {
    const html = `
      <html><body>
        <h1>Filtek Supreme XTE: Composite Restaurador Universal - Solventum</h1>
        <p><span>Marca:</span><a>Solventum</a></p>
        <p><span>Referencia:</span><strong>053M4910A3B</strong></p>
        <p><span>Ref. Fabricante:</span><span>4910A3B</span></p>
        <span>64,14 €</span><span>44,90 €</span>
        <div>Precio IVA incluido (10%) €49,39</div>
        <div>EN STOCK.</div>
        <div data-testid="variation-cards-label">Tipo: <b>1 Jer. de 3 gr - Color: A3 Body</b></div>
        <button data-variation-id="x"><span>A1 Body</span><span>1 Jer. de 3 gr</span><span>44,90 €</span></button>
      </body></html>`;
    const offers = normalizeDentaltix(parseDentaltixProductHtml(html, "https://www.dentaltix.com/es/demo?sku=053M4910A3B"));
    const selected = offers.find(o => o.manufacturerReference === "4910A3B");
    expect(selected).toBeDefined();
    expect(selected?.supplierSku).toBe("053M4910A3B");
    expect(selected?.salePrice).toBe(44.9);
    expect(selected?.vatStatus).toBe("excluded");
    expect(selected?.vatRate).toBe(10);
    expect(selected?.variant).toBe("Body");
    expect(selected?.shade).toBe("A3");
    expect(selected?.quantity).toBe(3);
  });

  it("normalizes Peeso 28 mm x 6 without confusing length and pack", () => {
    const html=`<html><body>
      <h1>Fresas endodoncia largo PEESO 28mm (6 uds.)</h1>
      <div>Marca: Dentsply</div>
      <div class="product-variation" data-sku="A1908113" data-manufacturer-reference="A000923000200">Nº2 28mm 6 unidades 32,61 € 22,83 € En stock</div>
    </body></html>`;
    const offers=normalizeDentaltix(parseDentaltixProductHtml(html,"https://www.dentaltix.com/demo-peeso"));
    expect(offers[0].presentation).toBe("Caja");
    expect(offers[0].quantity).toBe(28);
    expect(offers[0].unit).toBe("mm");
    expect(offers[0].packCount).toBe(6);
    expect(offers[0].variant).toBe("No2");
  });

  it("preserves glove variants as distinct references and normalizes box quantity safely", () => {
    const raw = parseDentaltixProductHtml(gloves, "https://www.dentaltix.com/demo-gloves");
    expect(raw.variants).toHaveLength(3);
    expect(raw.variants.map(v => v.manufacturerReference)).toEqual(["003642","003659","003666"]);
    const offers=normalizeDentaltix(raw);
    expect(offers[0].presentation).toBe("Caja");
    expect(offers[0].quantity).toBe(100);
    expect(offers[0].unit).toBe("ud");
    expect(offers[0].packCount).toBe(1);
    expect(offers[0].variant).toBe("XS");
  });
  it("normalizes Filtek Z250 syringe separately from capsules", () => {
    const html = `
      <html><body>
        <h1>Filtek Z250: Composite Universal - Solventum</h1>
        <p><span>Marca:</span><a>Solventum</a></p>
        <p><span>Referencia:</span><strong>053M6020A3</strong></p>
        <p><span>Ref. Fabricante:</span><span>6020A3</span></p>
        <span>88,43 €</span><span>61,90 €</span>
        <div>Precio IVA incluido (10%) 68,09 €</div>
        <div>EN STOCK.</div>
        <div data-testid="variation-cards-label">Tipo: <b>1 Jer. de 4 gr - Color: A3</b></div>
      </body></html>`;
    const offers = normalizeDentaltix(parseDentaltixProductHtml(html, "https://www.dentaltix.com/es/demo?sku=053M6020A3"));
    const selected = offers.find(o => o.manufacturerReference === "6020A3");
    expect(selected?.presentation).toBe("Jeringa");
    expect(selected?.quantity).toBe(4);
    expect(selected?.unit).toBe("g");
    expect(selected?.packCount).toBe(1);
    expect(selected?.shade).toBe("A3");
  });
  it("keeps Adper Scotchbond bottle separate from kit", () => {
    const html=`<html><body>
      <h1>Adper Scotchbond 1XT: Adhesivo Monocomponente - Solventum</h1>
      <p><span>Marca:</span><a>Solventum</a></p>
      <p><span>Referencia:</span><strong>053M4242</strong></p>
      <p><span>Ref. Fabricante:</span><span>4242</span></p>
      <span>177,00 €</span><span>123,90 €</span>
      <div>Precio IVA incluido (10%) 136,29 €</div>
      <div>EN STOCK.</div>
      <div data-testid="variation-cards-label">Tipo: <b>1 Bote de 6 gr</b></div>
      <button data-variation-id="kit"><span>KIT</span><span>189,90 €</span></button>
    </body></html>`;
    const offers=normalizeDentaltix(parseDentaltixProductHtml(html,"https://www.dentaltix.com/es/demo?sku=053M4242"));
    const selected=offers.find(o=>o.manufacturerReference==="4242");
    expect(selected?.presentation).toBe("Frasco");
    expect(selected?.quantity).toBe(6);
    expect(selected?.unit).toBe("ml");
    expect(selected?.packCount).toBe(1);
    expect(selected?.manufacturerReference).not.toBe("4241");
  });
  it("normalizes Scotchbond Universal Plus 41294 as one 5 ml bottle",()=>{
    const html=`<html><body>
      <h1>Scotchbond Universal Plus: Adhesivo Universal Radiopaco - Solventum</h1>
      <p><span>Marca:</span><a>Solventum</a></p>
      <p><span>Referencia:</span><strong>41294</strong></p>
      <p><span>Ref. Fabricante:</span><span>41294</span></p>
      <span>114,14 €</span><span>79,90 €</span><div>Precio IVA incluido (10%) 87,89 €</div><div>EN STOCK.</div>
      <div data-testid="variation-cards-label">Tipo: <b>1 Bote de 5 ml</b></div>
    </body></html>`;
    const offers=normalizeDentaltix(parseDentaltixProductHtml(html,"https://www.dentaltix.com/es/demo?sku=41294"));
    const offer=offers.find(o=>o.manufacturerReference==="41294");
    expect(offer?.presentation).toBe("Frasco");
    expect(offer?.quantity).toBe(5);
    expect(offer?.unit).toBe("ml");
    expect(offer?.packCount).toBe(1);
  });

  it("normalizes RelyX Universal shades from exact references",()=>{
    const html=`<html><body>
      <h1>RelyX Universal: Cemento de Resina Universal - Solventum</h1>
      <p><span>Marca:</span><a>Solventum</a></p>
      <div class="product-variation" data-sku="56972" data-manufacturer-reference="56972">Jeringa - 3,4 gr - A1 191,29 € 133,90 € En stock</div>
      <div class="product-variation" data-sku="56973" data-manufacturer-reference="56973">Jeringa - 3,4 gr - A3 Opaco 191,29 € 133,90 € En stock</div>
    </body></html>`;
    const offers=normalizeDentaltix(parseDentaltixProductHtml(html,"https://www.dentaltix.com/es/demo"));
    const a1=offers.find(o=>o.manufacturerReference==="56972");
    const ao3=offers.find(o=>o.manufacturerReference==="56973");
    expect(a1?.quantity).toBe(3.4);
    expect(a1?.unit).toBe("g");
    expect(a1?.shade).toBe("A1");
    expect(ao3?.shade).toBe("AO3");
  });
});
