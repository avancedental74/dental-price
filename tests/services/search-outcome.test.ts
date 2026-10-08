import {describe,it,expect} from "vitest";
import {evaluateCatalogOutcome,type SupplierCoverage} from "../../src/services/search-outcome";
import {ZeroResultDiagnostics} from "../../src/components/ZeroResultDiagnostics";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
const c=(status:SupplierCoverage["status"],id:string,offers=0):SupplierCoverage=>({
 supplierId:id,status,offers,queries:1,candidateLimitReached:false,partialErrors:0
});
describe("empty search must not masquerade as unavailable product",()=>{
 it("classifies total supplier failure separately from genuine no matches",()=>{
  expect(evaluateCatalogOutcome(0,[c("error","dentaltix"),c("error","dentipak")])).toBe("all_failed");
  expect(evaluateCatalogOutcome(0,[c("no_match","dentaltix"),c("no_match","dentipak")])).toBe("no_match");
  expect(evaluateCatalogOutcome(0,[c("error","dentaltix"),c("no_match","dentipak")])).toBe("partial_failure");
  expect(evaluateCatalogOutcome(0,[c("partial","dentaltix"),c("no_match","dentipak")])).toBe("partial_failure");
  expect(evaluateCatalogOutcome(0,[])).toBe("unavailable");
 });
 it("keeps partial errors visible when products were found",()=>{
  expect(evaluateCatalogOutcome(3,[c("results","dentipak",3),c("error","dentaltix")])).toBe("partial_results");
  expect(evaluateCatalogOutcome(3,[c("results","dentipak",3),c("partial","dentalexpress")])).toBe("partial_results");
  expect(evaluateCatalogOutcome(3,[c("results","dentipak",3)])).toBe("results");
 });
 it("renders actionable diagnostics and individual supplier statuses when zero products",()=>{
  const html=renderToStaticMarkup(createElement(ZeroResultDiagnostics,{
   query:"guantes",
   coverage:[c("error","dentaltix"),c("no_match","ortolan")],
   errors:[{supplierId:"dentaltix",message:"HTTP 503"}],
   depth:"standard" as const,onRetry:()=>{},onExpand:()=>{}
  }));
  expect(html).toContain("Búsqueda incompleta");
  expect(html).toContain("Dentaltix");
  expect(html).toContain("Ortolan");
  expect(html).toContain("HTTP 503");
  expect(html).toContain("Reintentar búsqueda");
  expect(html).toContain("Ampliar búsqueda");
  expect(html).not.toContain("No encontramos");
 });
 it("does not label all failed suppliers as product absent",()=>{
  const html=renderToStaticMarkup(createElement(ZeroResultDiagnostics,{
   query:"guantes",coverage:[c("error","dentipak"),c("error","dentalcost")],
   errors:[],depth:"extended" as const,onRetry:()=>{},onExpand:()=>{}
  }));
  expect(html).toContain("No se pudieron consultar");
  expect(html).not.toContain("Sin coincidencias en los depósitos consultados");
 });
});
