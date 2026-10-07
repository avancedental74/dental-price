import { describe, expect, it } from "vitest";
import { fetchOrtolanProduct } from "../../src/connectors/ortolan";

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
});