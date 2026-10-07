import { describe, expect, it } from "vitest";
import { parseDvdProductHtml } from "../../src/connectors/dvd-dental/parser";
import { normalizeDvd } from "../../src/connectors/dvd-dental/normalizer";

const html=`<html><body>
<h2>SOLVENTUM</h2><h1>Composite Filtek supreme XTE jeringas (3g)</h1>
<table><tr><th>Nombre</th><th>Ref. DVD</th><th>Ref. fabr.</th><th>Precio web</th><th>Precio oferta</th></tr>
<tr><td>A3 Body</td><td>7120</td><td>4910A3B</td><td>46,70 €</td><td>45,80 €</td></tr>
<tr><td>B2 Body</td><td>7124</td><td>4910B2B</td><td>46,70 €</td><td>45,80 €</td></tr></table>
<div>Disponible para compra. Te faltan 110.00€ para envío gratis</div>
</body></html>`;

describe("DVD Dental connector",()=>{
 it("extracts product-table references and shipping policy",()=>{
   const raw=parseDvdProductHtml(html,"https://www.dvd-dental.com/composite-filtek-supreme-xte-jeringas-3g/");
   expect(raw.variants).toHaveLength(2);
   const offers=normalizeDvd(raw);
   expect(offers[0].manufacturerReference).toBe("4910A3B");
   expect(offers[0].supplierSku).toBe("7120");
   expect(offers[0].presentation).toBe("Jeringa");
   expect(offers[0].quantity).toBe(3);
   expect(offers[0].sourceMode).toBe("automatic");
 });
  it("parses a simple Scotchbond 41294 page safely",()=>{
    const html=`<html><body>
      <h2>SOLVENTUM</h2><h1>Adhesivo Scotchbond Universal Plus (5ml)</h1>
      <div>Contenido: Frasco de 5ml.</div>
      <div>REF. FAB: 41294</div>
      <div>631 en stock</div>
      <div>94,49€ IVA incl. (Incluido impuestos)</div>
      <div>85,90€ excl. Tax (Excluyendo impuestos)</div>
      <div>Disponible para compra.</div>
    </body></html>`;
    const raw=parseDvdProductHtml(html,"https://www.dvd-dental.com/adhesivo-scotchbond-universal-plus-5ml/");
    const offers=normalizeDvd(raw);
    expect(offers).toHaveLength(1);
    expect(offers[0].manufacturerReference).toBe("41294");
    expect(offers[0].presentation).toBe("Frasco");
    expect(offers[0].quantity).toBe(5);
    expect(offers[0].unit).toBe("ml");
    expect(offers[0].stockStatus).toBe("in_stock");
    expect(offers[0].regularPrice).toBe(85.9);
    expect(offers[0].vatRate).toBe(10);
  });
  it("parses single-product Scotchbond 41294 without trusting arbitrary h2 headings",()=>{
    const html=`<html><body>
      <h2>Restauración</h2>
      <div>SOLVENTUM</div>
      <h1>Adhesivo Scotchbond Universal Plus (5ml)</h1>
      <div>87,84€ IVA incl. (Incluido impuestos)</div>
      <div>79,85€ excl. Tax (Excluyendo impuestos)</div>
      <div>REF. DVD 3138780</div>
      <div>410 en stock</div>
      <div>Contenido: Frasco de 5ml.</div>
      <div>REF. FAB: 41294</div>
    </body></html>`;
    const raw=parseDvdProductHtml(html,"https://www.dvd-dental.com/adhesivo-scotchbond-universal-plus-5ml/");
    const offers=normalizeDvd(raw);
    expect(raw.manufacturer?.toUpperCase()).toBe("SOLVENTUM");
    expect(offers).toHaveLength(1);
    expect(offers[0].manufacturerReference).toBe("41294");
    expect(offers[0].supplierSku).toBe("3138780");
    expect(offers[0].presentation).toBe("Frasco");
    expect(offers[0].quantity).toBe(5);
    expect(offers[0].unit).toBe("ml");
    expect(offers[0].stockStatus).toBe("in_stock");
    expect(offers[0].regularPrice).toBe(79.85);
    expect(offers[0].vatRate).toBe(10);
  });
});
