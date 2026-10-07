import { describe, expect, it } from "vitest";
import { parseDentalCostProductHtml } from "../../src/connectors/dentalcost/parser";
import { normalizeDentalCost } from "../../src/connectors/dentalcost/normalizer";

const html=`<html><body>
<h1>Filtek Supreme XTE Composite Universal Opacidad Body 3gr. 3M Espe</h1>
<div>Solventum</div>
<div>-35% 73,63 € Precio sin IVA 47,86 € Precio con IVA (10%) 52,65 €</div>
<div>Todas referencias
Filtek Supreme XTE Composite Universal Opacidad Body 3gr 3M Espe: A3
Ref: 06873M3
Ref fabricante: 4910A3B
Disponibilidad: 271uds
47,86 €
Añadir al Carrito
Filtek Supreme XTE Composite Universal Opacidad Body 3gr 3M Espe: B2
Ref: 06873M7
Ref fabricante: 4910B2B
Disponibilidad: Fuera de stock
47,86 €</div>
</body></html>`;

describe("DentalCost connector",()=>{
 it("extracts exact references, stock and variant prices",()=>{
   const raw=parseDentalCostProductHtml(html,"https://www.dentalcost.es/composites-universales/687-demo.html");
   expect(raw.vatRate).toBe(10);
   expect(raw.variants.map(v=>v.manufacturerReference)).toEqual(["4910A3B","4910B2B"]);
   const offers=normalizeDentalCost(raw);
   expect(offers[0].supplierId).toBe("dentalcost");
   expect(offers[0].salePrice).toBe(47.86);
   expect(offers[0].shade).toBe("A3");
   expect(offers[0].presentation).toBe("Jeringa");
   expect(offers[0].variant).toBe("Body");
   expect(offers[0].stockStatus).toBe("in_stock");
   expect(offers[0].shippingCost).toBe(5.8);
   expect(offers[0].freeShippingThreshold).toBe(120);
   expect(offers[1].stockStatus).toBe("unavailable");
 });
});
