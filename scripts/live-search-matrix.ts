import {writeFileSync,mkdirSync} from "node:fs";
import {dirname} from "node:path";
import {liveAutomaticSupplierIds,type SearchSupplierId} from "../src/connectors/live-supplier-registry";

const endpoint=process.env.LIVE_API_URL ?? "https://dental-price-live.avance-dental74.workers.dev";
const output=process.env.LIVE_MATRIX_OUT ?? "docs/live-search-matrix.latest.json";
const timeoutMs=Number(process.env.LIVE_MATRIX_TIMEOUT_MS ?? 25000);
const delayMs=Number(process.env.LIVE_MATRIX_DELAY_MS ?? 450);
const depth=(process.env.LIVE_MATRIX_DEPTH==="extended"?"extended":"standard") as "standard"|"extended";

const queries=[
  "4910A3B",
  "Filtek Supreme XTE A3 Body 3 g",
  "Filtek Z250 A3 4 g",
  "Scotchbond Universal Plus 41294",
  "RelyX Universal A1 56972",
  "Tetric EvoCeram A3,5 Dentina jeringa",
  "composite fluido A2",
  "adhesivo universal dental",
  "cemento resina dual",
  "articaina 1:100000",
  "lidocaina dental carpules",
  "agujas dentales 30G cortas",
  "Peeso 28 mm n 1",
  "limas K 25 mm nº 15",
  "fresas diamantadas grano fino",
  "fresa tungsteno cirugía",
  "alginato 500 g",
  "silicona adicion pesada",
  "cubetas impresion perforadas",
  "sutura seda 3/0",
  "hojas bisturi 15C",
  "implante titanio 4.0 10 mm",
  "tornillo cicatrizacion implante",
  "guantes nitrilo talla M sin polvo",
  "mascarillas quirurgicas tipo IIR",
  "desinfectante instrumental dental",
  "hipoclorito sodico endodoncia",
  "clorhexidina gel",
  "lampara polimerizar",
  "contraangulo 1:1"
];

interface SupplierResult {
  supplierId:SearchSupplierId;
  status:"results"|"no_match"|"error"|"partial";
  offers:number;
  candidateCount:number;
  verifiedCandidateCount:number;
  candidateLimitReached:boolean;
  error:string|null;
  elapsedMs:number;
  sample:Array<{
    name:string;
    reference?:string;
    sku?:string;
    price?:number;
    verification?:string;
    sourceStatus:string;
  }>;
}

async function fetchJson(url:string){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const started=Date.now();
    const response=await fetch(url,{headers:{accept:"application/json"},signal:controller.signal});
    const elapsedMs=Date.now()-started;
    const text=await response.text();
    let data:unknown;
    try{data=JSON.parse(text);}catch{data={error:"NON_JSON_RESPONSE",body:text.slice(0,300)};}
    return {response,data,elapsedMs};
  }finally{clearTimeout(timer);}
}

async function runSupplier(query:string,supplierId:SearchSupplierId,sessionId:string):Promise<SupplierResult>{
  const url=endpoint.replace(/\/$/,"")+"/search-supplier?q="+encodeURIComponent(query)+
    "&supplier="+encodeURIComponent(supplierId)+"&sessionId="+encodeURIComponent(sessionId)+"&depth="+depth;
  try{
    const {response,data,elapsedMs}=await fetchJson(url);
    const body=data as {
      offers?:Array<{rawName:string;manufacturerReference?:string;supplierSku?:string;salePrice?:number;regularPrice:number;priceVerification?:string;sourceStatus:string}>;
      error?:string|null;
      noMatch?:boolean;
      partial?:boolean;
      candidateCount?:number;
      verifiedCandidateCount?:number;
      candidateLimitReached?:boolean;
    };
    const offers=Array.isArray(body.offers)?body.offers:[];
    const httpError=response.ok?null:"HTTP "+response.status;
    const error=body.error??httpError;
    const status:SupplierResult["status"]=httpError?"error":offers.length?"results":body.partial?"partial":body.noMatch?"no_match":error?"partial":"partial";
    return {
      supplierId,status,offers:offers.length,
      candidateCount:body.candidateCount??0,
      verifiedCandidateCount:body.verifiedCandidateCount??0,
      candidateLimitReached:Boolean(body.candidateLimitReached),
      error,
      elapsedMs,
      sample:offers.slice(0,3).map(offer=>({
        name:offer.rawName,
        reference:offer.manufacturerReference,
        sku:offer.supplierSku,
        price:offer.salePrice??offer.regularPrice,
        verification:offer.priceVerification,
        sourceStatus:offer.sourceStatus
      }))
    };
  }catch(error){
    return {
      supplierId,status:"error",offers:0,candidateCount:0,verifiedCandidateCount:0,candidateLimitReached:false,
      error:error instanceof Error?error.message:"SEARCH_ERROR",elapsedMs:timeoutMs,sample:[]
    };
  }
}

const startedAt=new Date().toISOString();
const rows=[];
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
for(const [index,query] of queries.entries()){
  const sessionId="matrix-"+Date.now()+"-"+index;
  const suppliers:SupplierResult[]=[];
  for(const supplierId of liveAutomaticSupplierIds){
    suppliers.push(await runSupplier(query,supplierId,sessionId));
    await wait(delayMs);
  }
  rows.push({
    query,sessionId,
    totals:{
      suppliersWithResults:suppliers.filter(item=>item.status==="results").length,
      suppliersNoMatch:suppliers.filter(item=>item.status==="no_match").length,
      suppliersWithErrors:suppliers.filter(item=>item.status==="error").length,
      totalOffers:suppliers.reduce((sum,item)=>sum+item.offers,0),
      totalCandidates:suppliers.reduce((sum,item)=>sum+item.candidateCount,0),
      verifiedCandidates:suppliers.reduce((sum,item)=>sum+item.verifiedCandidateCount,0),
      candidateLimits:suppliers.filter(item=>item.candidateLimitReached).length
    },
    suppliers
  });
}

const report={
  generatedAt:new Date().toISOString(),
  startedAt,
  endpoint,
  depth,
  queryCount:queries.length,
  supplierCount:liveAutomaticSupplierIds.length,
  rows,
  summary:{
    totalOffers:rows.reduce((sum,row)=>sum+row.totals.totalOffers,0),
    totalCandidates:rows.reduce((sum,row)=>sum+row.totals.totalCandidates,0),
    verifiedCandidates:rows.reduce((sum,row)=>sum+row.totals.verifiedCandidates,0),
    unverifiedCandidateLowerBound:rows.reduce((sum,row)=>sum+Math.max(0,row.totals.totalCandidates-row.totals.verifiedCandidates),0),
    resultCells:rows.reduce((sum,row)=>sum+row.totals.suppliersWithResults,0),
    noMatchCells:rows.reduce((sum,row)=>sum+row.totals.suppliersNoMatch,0),
    errorCells:rows.reduce((sum,row)=>sum+row.totals.suppliersWithErrors,0),
    candidateLimitCells:rows.reduce((sum,row)=>sum+row.totals.candidateLimits,0)
  }
};

mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify(report.summary,null,2));
console.log("Wrote "+output);
