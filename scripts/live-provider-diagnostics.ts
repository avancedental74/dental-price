import {writeFileSync,mkdirSync} from "node:fs";
import {dirname} from "node:path";
import {searchOneSupplier,type SearchDiagnostics} from "../worker/live-api";
import type {SearchSupplierId} from "../src/connectors/live-supplier-registry";

const output=process.env.LIVE_PROVIDER_DIAG_OUT ?? "docs/live-provider-diagnostics.latest.json";

const cases:Array<{supplierId:SearchSupplierId;query:string;depth:"standard"|"extended"}>=[
  {supplierId:"dentaltix",query:"4910A3B",depth:"standard"},
  {supplierId:"dentalcost",query:"4910A3B",depth:"standard"},
  {supplierId:"dvd-dental",query:"4910A3B",depth:"standard"},
  {supplierId:"dentalexpress",query:"41294",depth:"standard"},
  {supplierId:"ortolan",query:"Tetric EvoCeram A3,5 Dentina",depth:"standard"},
  {supplierId:"dentipak",query:"41294",depth:"standard"},
  {supplierId:"dentalboom",query:"Scotchbond Universal Plus",depth:"standard"}
];

const rows=[];
for(const item of cases){
  const requestedAt=new Date().toISOString();
  const diagnostics:SearchDiagnostics={startedAt:requestedAt,events:[]};
  const started=Date.now();
  try{
    const result=await searchOneSupplier(item.supplierId,item.query,"local-diagnostic",item.depth,diagnostics);
    rows.push({
      ...item,
      elapsedMs:Date.now()-started,
      offers:result.offers.length,
      error:result.error??null,
      noMatch:result.noMatch??false,
      discoveredFrom:result.discoveredFrom,
      candidateLimitReached:result.candidateLimitReached??false,
      sample:result.offers.slice(0,3).map(offer=>({
        name:offer.rawName,
        reference:offer.manufacturerReference,
        sku:offer.supplierSku,
        price:offer.salePrice??offer.regularPrice,
        verification:offer.priceVerification,
        sourceStatus:offer.sourceStatus
      })),
      diagnostics
    });
  }catch(error){
    rows.push({
      ...item,
      elapsedMs:Date.now()-started,
      offers:0,
      error:error instanceof Error?error.message:"SEARCH_ERROR",
      noMatch:false,
      diagnostics
    });
  }
}

const report={
  generatedAt:new Date().toISOString(),
  rows,
  summary:{
    suppliers:rows.length,
    withOffers:rows.filter(row=>row.offers>0).length,
    withErrors:rows.filter(row=>row.error).length,
    totalOffers:rows.reduce((sum,row)=>sum+row.offers,0)
  }
};

mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify(report.summary,null,2));
for(const row of rows){
  console.log(`${row.supplierId}: offers=${row.offers} error=${row.error??"none"} elapsed=${row.elapsedMs}ms`);
}
