import { describe, expect, it } from "vitest";
import { fetchDentalExpressProduct } from "../../src/connectors/dentalexpress";

describe("Dental Express connector",()=>{
  it("uses manufacturer reference and infers 10% VAT from gross price",async()=>{
    const html=`<html><body><h1>Scotchbond Universal Plus 5ml</h1>
      <div>Referencia del fabricante: 41294</div><div>Referencia DE: 350-6016</div>
      <div>110,01 €</div><div>Precio con IVA incluido: 121,01 €</div><div>Disponible</div>
      <script type="application/ld+json">{"@type":"Product","name":"Scotchbond Universal Plus","mpn":"41294","sku":"350-6016","brand":{"name":"Solventum"},"offers":{"price":"110.01","availability":"InStock"}}</script>
    </body></html>`;
    const fetchImpl=(async()=>new Response(html,{status:200})) as typeof fetch;
    const {offers}=await fetchDentalExpressProduct("https://dentalexpress.es/demo",fetchImpl);
    expect(offers).toHaveLength(1);
    expect(offers[0].manufacturerReference).toBe("41294");
    expect(offers[0].supplierSku).toBe("350-6016");
    expect(offers[0].vatStatus).toBe("excluded");
    expect(offers[0].vatRate).toBe(10);
  });
  it("does not treat a shipping threshold or global promo as the product price",async()=>{
    const html=`<html><body>
      <h1>TETRIC EVOCERAM JERINGA 3G IVOCLAR</h1>
      <div class="shipping-banner">Envío gratis a partir de 90€</div>
      <div>Disponible</div>
    </body></html>`;
    const fetchImpl=(async()=>new Response(html,{status:200})) as typeof fetch;
    const {offers}=await fetchDentalExpressProduct("https://dentalexpress.es/tetric-evoceram-jeringa-3g-ivoclar",fetchImpl);
    expect(offers).toHaveLength(0);
  });
});
