import { describe, expect, it } from "vitest";
import { fetchDentipakProduct } from "../../src/connectors/dentipak";

describe("Dentipak connector",()=>{
  it("keeps supplier SKU separate from explicit manufacturer reference",async()=>{
    const html=`<html><body>
      <h1>ADHESIVO SCOTCHBOND UNIVERSAL PLUS (5 ml) 41294 - 3M SOLVENTUM</h1>
      <div>Scotchbond Universal Plus (Ref. 41294)</div>
      <span class="oe_default_price"><span class="oe_currency_value">136,23</span></span>
      <script type="application/ld+json">[{"@context":"https://schema.org","@type":"Product","name":"ADHESIVO SCOTCHBOND UNIVERSAL PLUS (5 ml) 41294 - 3M SOLVENTUM","sku":"041299","offers":{"@type":"Offer","price":79.9,"priceCurrency":"EUR","availability":"https://schema.org/InStock"}}]</script>
    </body></html>`;
    const fetchImpl=(async()=>new Response(html,{status:200})) as typeof fetch;
    const {offers}=await fetchDentipakProduct("https://www.dentipak.es/shop/demo",fetchImpl);
    expect(offers).toHaveLength(1);
    expect(offers[0].supplierSku).toBe("041299");
    expect(offers[0].manufacturerReference).toBe("41294");
    expect(offers[0].salePrice).toBe(79.9);
    expect(offers[0].regularPrice).toBe(136.23);
    expect(offers[0].stockStatus).toBe("in_stock");
    expect(offers[0].vatStatus).toBe("unknown");
  });
});
