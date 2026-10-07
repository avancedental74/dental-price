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
   expect(offers[0].shippingCost).toBe(6);
   expect(offers[0].freeShippingThreshold).toBe(110);
   expect(offers[0].sourceMode).toBe("automatic");
 });
});
