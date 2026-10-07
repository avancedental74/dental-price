import { describe, expect, it } from "vitest";
import { fetchBrokerDentalProduct } from "../../src/connectors/brokerdental";

describe("Broker Dental connector",()=>{
  it("keeps manufacturer reference separate and does not assume VAT",async()=>{
    const html=`<html><body><h1>EQUIA Fil A2</h1><div>Marca GC</div>
      <table><tr><td>Ref: BD-4261 Ref. fabricante: 004261 45,00 € 39,00 € Disponible</td></tr></table>
    </body></html>`;
    const fetchImpl=(async()=>new Response(html,{status:200})) as typeof fetch;
    const {offers}=await fetchBrokerDentalProduct("https://www.brokerdental.es/demo",fetchImpl);
    expect(offers[0].manufacturerReference).toBe("004261");
    expect(offers[0].vatStatus).toBe("unknown");
    expect(offers[0].vatRate).toBeUndefined();
  });
});