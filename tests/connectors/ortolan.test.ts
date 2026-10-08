import { describe, expect, it } from "vitest";
import { fetchOrtolanProduct } from "../../src/connectors/ortolan";
import { searchOrtolanRecords } from "../../src/connectors/live-search";

describe("Ortolan connector",()=>{
  it("does not promote an Ortolan SKU to manufacturer reference",async()=>{
    const html=`<html><body><h1>Tetric EvoCeram</h1><div>COD: ORT-100</div>
      <table><tr><td>ORT-A3 A3 Jeringa 3 g 42,50 € Disponible</td></tr></table>
    </body></html>`;
    const fetchImpl=(async()=>new Response(html,{status:200})) as typeof fetch;
    const {offers}=await fetchOrtolanProduct("https://ortolan.es/es/demo",fetchImpl);
    expect(offers).toHaveLength(1);
    expect(offers[0].supplierSku).toBe("ORT-A3");
    expect(offers[0].manufacturerReference).toBeUndefined();
  });

  it("does not treat a quantity control or generic 24/48 h banner as proof of stock",async()=>{
    const html=`<html><body><h1>Tetric EvoCeram</h1><div>Entrega 24/48 horas</div>
      <table><tr><td>EVOCER-JERA1 A1 Jeringa 3 g 63,72 € Cantidad Sum.</td></tr></table>
    </body></html>`;
    const fetchImpl=(async()=>new Response(html,{status:200})) as typeof fetch;
    const {offers}=await fetchOrtolanProduct("https://ortolan.es/es/demo",fetchImpl);
    expect(offers[0].stockStatus).toBe("unknown");
    expect(offers[0].vatStatus).toBe("excluded");
  });


  it("expands a search result into structured Ortolan variants with stock",async()=>{
    const searchHtml=`<html><body>
      <article data-id-product="3802"><a href="https://ortolan.es/es/odontologia/3802-3814-tetric-evoceram.html"><h3 class="product-title">TETRIC EVOCERAM</h3></a></article>
      <script>{"item_id":"3802-3814","item_name":"TETRIC EVOCERAM","price":63.72,"item_variant":"A1 - Jeringa de 3grm"}</script>
    </body></html>`;
    const detailHtml=`<html><body><script>
      {"id_product_attribute":3814,"id_product":3802,"reference":"EVOCER-JERA1","supplier_reference":"","ean13":"","price":63.72,"attribute_designation":"Color - A1, Formato - Jeringa de 3grm","quantity":998}
      {"id_product_attribute":3817,"id_product":3802,"reference":"EVOCER-JERA3,5","supplier_reference":"","ean13":"","price":63.72,"attribute_designation":"Color - A3,5, Formato - Jeringa de 3grm","quantity":0}
    </script></body></html>`;
    const fetchImpl=(async(url:string|URL|Request)=>{
      const value=String(url);
      return new Response(value.includes("busqueda")?searchHtml:detailHtml,{status:200});
    }) as typeof fetch;
    const records=await searchOrtolanRecords("Tetric EvoCeram A3,5",fetchImpl,8);
    expect(records[0].supplierSku).toBe("EVOCER-JERA3,5");
    expect(records[0].stockQuantity).toBe(0);
    expect(records[0].variant).toContain("A3,5");
  });

});
