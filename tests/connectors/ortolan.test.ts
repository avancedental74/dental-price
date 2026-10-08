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

  it("does not treat a quantity control or generic 24/48 h banner as proof of stock",async()=>{
    const html=`<html><body><h1>Tetric EvoCeram</h1><div>Entrega 24/48 horas</div>
      <table><tr><td>EVOCER-JERA1 A1 Jeringa 3 g 63,72 € Cantidad Sum.</td></tr></table>
    </body></html>`;
    const fetchImpl=(async()=>new Response(html,{status:200})) as typeof fetch;
    const {offers}=await fetchOrtolanProduct("https://ortolan.es/es/demo",fetchImpl);
    expect(offers[0].stockStatus).toBe("unknown");
    expect(offers[0].vatStatus).toBe("excluded");
  });

});
