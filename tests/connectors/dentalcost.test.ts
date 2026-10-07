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
 it("normalizes Peeso packaging and variant from public rows",()=>{
   const peeso=`<html><body><h1>Fresa Ensanchadora Peeso Largo 28mm 6 uds. Maillefer</h1><div>Maillefer Precio sin IVA 17,52 € Precio con IVA (21%) 21,19 €</div><div>Fresa Ensanchadora Peeso Largo 28mm 6 uds. Maillefer: Nº1 Ref: 5513MA1 Ref fabricante: A000923000100 Disponibilidad: 6uds 17,52 €</div></body></html>`;
   const [offer]=normalizeDentalCost(parseDentalCostProductHtml(peeso,"https://www.dentalcost.es/fresas-endodoncia/5513-demo.html"));
   expect(offer.manufacturerReference).toBe("A000923000100");
   expect(offer.presentation).toBe("Caja");
   expect(offer.quantity).toBe(28);
   expect(offer.unit).toBe("mm");
   expect(offer.packCount).toBe(6);
   expect(offer.variant).toBe("No1");
 });

 it("normalizes AIR-N-GO as four bottles of 250 g",()=>{
   const air=`<html><body><h1>Air-N-Go Classic Polvo Para Aeropulidor 4 Botes 250gr. Satelec Acteon</h1><div>Acteon Precio sin IVA 66,63 € Precio con IVA (21%) 80,62 €</div><div>Air-N-Go Classic Polvo Para Aeropulidor 4 Botes 250gr. Satelec Acteon: Limón Ref: 4155SA2 Ref fabricante: F10251 Disponibilidad: 8uds 66,63 €</div></body></html>`;
   const [offer]=normalizeDentalCost(parseDentalCostProductHtml(air,"https://www.dentalcost.es/polvo-aeropulidores/4155-demo.html"));
   expect(offer.manufacturerReference).toBe("F10251");
   expect(offer.presentation).toBe("Frasco");
   expect(offer.quantity).toBe(250);
   expect(offer.unit).toBe("g");
   expect(offer.packCount).toBe(4);
 });

  it("normalizes Filtek Z250 6020 syringe references",()=>{
    const z250=`<html><body>
      <h1>Filtek Z250 Composite Universal Jeringa Reposición 4g. 3M Espe</h1>
      <div>Solventum</div>
      <div>Precio sin IVA 63,43 € Precio con IVA (10%) 69,77 €</div>
      <div>Todas referencias Filtek Z250 Composite Universal Jeringa Reposición 4g. 3M Espe: A3
      Ref: 02653M3 Ref fabricante: 6020A3 Disponibilidad: 25uds 63,43 €</div>
    </body></html>`;
    const offers=normalizeDentalCost(parseDentalCostProductHtml(z250,"https://www.dentalcost.es/composites-universales/265-demo.html"));
    const offer=offers.find(o=>o.manufacturerReference==="6020A3");
    expect(offer?.presentation).toBe("Jeringa");
    expect(offer?.quantity).toBe(4);
    expect(offer?.packCount).toBe(1);
    expect(offer?.shade).toBe("A3");
  });
  it("normalizes Adper Scotchbond 1XT 4242 as a 6 ml bottle",()=>{
    const adper=`<html><body>
      <h1>Adper Scotchbond 1XT Adhesivo Reposición 6ml. 3M Espe</h1>
      <div>Solventum Precio sin IVA 127,24 € Precio con IVA (10%) 139,96 €</div>
      <div>Adper Scotchbond 1XT Adhesivo Reposición 6g. 3M Espe
      Ref: 02273M Ref fabricante: 4242 Disponibilidad: 44 artículo disponible 127,24 €</div>
    </body></html>`;
    const [offer]=normalizeDentalCost(parseDentalCostProductHtml(adper,"https://www.dentalcost.es/adhesivos/227-demo.html"));
    expect(offer.manufacturerReference).toBe("4242");
    expect(offer.presentation).toBe("Frasco");
    expect(offer.quantity).toBe(6);
    expect(offer.unit).toBe("ml");
    expect(offer.packCount).toBe(1);
  });
});
