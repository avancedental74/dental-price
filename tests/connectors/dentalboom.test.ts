import { describe, expect, it } from "vitest";
import { fetchDentalBoomProduct } from "../../src/connectors/dentalboom";

describe("Dental Boom connector",()=>{
  it("parses public Product JSON-LD while keeping internal SKU out of manufacturer reference",async()=>{
    const html=`<html><body>
      <h1>Scotchbond Universal Plus 3M 5ml</h1>
      <div><del><span class="woocommerce-Price-amount">131,63 €</span></del></div>
      <p>107,39 € 118,13 € con IVA (10%)</p>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","brand":{"@type":"Brand","name":"3M"},"name":"Scotchbond Universal Plus 3M 5ml | Dental Boom","sku":"059652","description":"Frasco de 5 ml","offers":{"@type":"Offer","price":"107.39","priceCurrency":"EUR","availability":"http://schema.org/InStock","priceSpecification":{"valueAddedTaxIncluded":"false"}}}]}</script>
    </body></html>`;
    const fetchImpl=(async()=>new Response(html,{status:200})) as typeof fetch;
    const {offers}=await fetchDentalBoomProduct("https://dentalboom.com/shop/demo",fetchImpl);
    expect(offers).toHaveLength(1);
    expect(offers[0].supplierSku).toBe("059652");
    expect(offers[0].manufacturerReference).toBeUndefined();
    expect(offers[0].salePrice).toBe(107.39);
    expect(offers[0].regularPrice).toBe(131.63);
    expect(offers[0].vatStatus).toBe("excluded");
    expect(offers[0].vatRate).toBe(10);
    expect(offers[0].stockStatus).toBe("in_stock");
    expect(offers[0].quantity).toBe(5);
    expect(offers[0].unit).toBe("ml");
  });
});
