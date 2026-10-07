import { readFile, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";
import type { SupplierPolicy } from "../src/domain/supplier-policies";

const policies=JSON.parse(await readFile("data/supplier-policies.json","utf8")) as SupplierPolicy[];
const UA="DentalPrice/0.2 (+https://github.com/avancedental74/dental-price; supplier-policy verification)";
const euro=(value:string)=>Number(value.replace(",", "."));
const close=(a:number,b:number,tolerance=0.05)=>Math.abs(a-b)<=tolerance;

async function textFor(url:string):Promise<string>{
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(url,{headers:{"user-agent":UA,accept:"text/html,application/xhtml+xml"},signal:controller.signal});
    if(!response.ok) throw new Error("HTTP "+response.status+" for "+url);
    return cheerio.load(await response.text())("body").text().replace(/\s+/g," ").trim();
  }finally{clearTimeout(timer);}
}

function verify(policy:SupplierPolicy,text:string):string{
  if(policy.supplierId==="dentaltix"){
    const cost=text.match(/Coste:\s*(\d+(?:[.,]\d+)?)\s*€\s*\+?\s*IVA/i)?.[1];
    const threshold=text.match(/gratuitos?\s+para\s+pedidos?\s+superiores?\s+a\s*(\d+(?:[.,]\d+)?)\s*€\s*\(antes\s+de\s+IVA\)/i)?.[1];
    if(!cost||!threshold) throw new Error("Dentaltix shipping policy pattern not found");
    if(!close(euro(cost),policy.shippingCost)||!close(euro(threshold),policy.freeShippingThreshold)||policy.freeShippingThresholdBasis!=="net") throw new Error("Dentaltix shipping policy changed");
    return "Dentaltix standard shipping and threshold verified";
  }
  if(policy.supplierId==="dvd-dental"){
    const cost=text.match(/tasa\s+de\s*(\d+(?:[.,]\d+)?)\s*€\s*\(\+\s*IVA\)/i)?.[1];
    const threshold=text.match(/igual\s+o\s+superior\s+a\s*(\d+(?:[.,]\d+)?)\s*€\s*\(IVA\s+no\s+incluido\)/i)?.[1];
    if(!cost||!threshold) throw new Error("DVD Dental shipping policy pattern not found");
    if(!close(euro(cost),policy.shippingCost)||!close(euro(threshold),policy.freeShippingThreshold)||policy.freeShippingThresholdBasis!=="net") throw new Error("DVD Dental shipping policy changed");
    return "DVD Dental shipping and threshold verified";
  }
  if(policy.supplierId==="dentalcost"){
    const grossCost=text.match(/compras?\s+inferiores?\s+a\s*120\s*€[^.]{0,120}?Península\)?\s+ser[aá]n\s+de\s*(\d+(?:[.,]\d+)?)\s*€/i)?.[1]
      ?? text.match(/Península\)?\s+ser[aá]n\s+de\s*(\d+(?:[.,]\d+)?)\s*€/i)?.[1];
    const threshold=text.match(/a\s+partir\s+de\s*(\d+(?:[.,]\d+)?)\s*€[^.]{0,100}?no\s+comportar[aá]\s+gastos/i)?.[1]
      ?? text.match(/superior(?:es)?\s+a\s*(\d+(?:[.,]\d+)?)\s*€[^.]{0,120}?gratuit/i)?.[1];
    if(!grossCost||!threshold) throw new Error("DentalCost shipping policy pattern not found");
    const currentGross=policy.shippingCostVatIncluded?policy.shippingCost:policy.shippingCost*(1+policy.shippingVatRate/100);
    if(!close(euro(grossCost),currentGross,0.05)||!close(euro(threshold),policy.freeShippingThreshold)||policy.freeShippingThresholdBasis!=="gross") throw new Error("DentalCost shipping policy changed");
    return "DentalCost shipping and threshold verified";
  }
  if(policy.supplierId==="proclinic"){
    const cost=text.match(/gastos de envío estándar (?:son|serán)\s*(\d+(?:[.,]\d+)?)\s*€\s*\+\s*IVA/i)?.[1]
      ?? text.match(/portes (?:costarán|serán de)\s*(\d+(?:[.,]\d+)?)\s*€/i)?.[1];
    const threshold=text.match(/a partir de\s*(\d+(?:[.,]\d+)?)\s*€\s*sin impuestos incluidos/i)?.[1]
      ?? text.match(/superiores? a\s*(\d+(?:[.,]\d+)?)\s*€\s*antes de IVA/i)?.[1];
    if(!cost||!threshold) throw new Error("Proclinic shipping policy pattern not found");
    if(!close(euro(cost),policy.shippingCost)||!close(euro(threshold),policy.freeShippingThreshold)||policy.freeShippingThresholdBasis!=="net") throw new Error("Proclinic shipping policy changed");
    return "Proclinic shipping and threshold verified";
  }
  if(policy.supplierId==="dentalexpress"){
    const threshold=text.match(/supere\s*(\d+(?:[.,]\d+)?)\s*€\s*\(IVA no incluido\)/i)?.[1];
    const cost=text.match(/tasa de\s*(\d+(?:[.,]\d+)?)\s*€\s*\(\+ IVA\)/i)?.[1];
    const smallThreshold=text.match(/inferiores a\s*(\d+(?:[.,]\d+)?)\s*€\s*\(IVA no incluido\)[^0-9]{0,80}tasa adicional de\s*(\d+(?:[.,]\d+)?)\s*€\s*\(\+ IVA\)/i);
    if(!threshold||!cost||!smallThreshold) throw new Error("Dental Express shipping policy pattern not found");
    if(!close(euro(cost),policy.shippingCost)||!close(euro(threshold),policy.freeShippingThreshold)||policy.freeShippingThresholdBasis!=="net") throw new Error("Dental Express shipping policy changed");
    if(!close(euro(smallThreshold[1]),policy.smallOrderThreshold??-1)||!close(euro(smallThreshold[2]),policy.smallOrderSurcharge??-1)) throw new Error("Dental Express small-order policy changed");
    return "Dental Express shipping, threshold and small-order surcharge verified";
  }
  throw new Error("Unsupported supplier policy "+policy.supplierId);
}

const verifiedAt=new Date().toISOString();
const results=[] as {supplierId:string;message:string;status:"verified"|"preserved"}[];
for(const policy of policies){
  try{
    const body=await textFor(policy.sourceUrl);
    const message=verify(policy,body);
    policy.observedAt=verifiedAt;
    results.push({supplierId:policy.supplierId,message,status:"verified"});
  }catch(error){
    const message=error instanceof Error?error.message:"Unknown policy verification error";
    if(policy.supplierId==="proclinic"&&message.includes("HTTP 405")){
      results.push({supplierId:policy.supplierId,message:"Proclinic blocks GitHub Actions (HTTP 405); preserving last externally verified policy",status:"preserved"});
      continue;
    }
    throw error;
  }
}
await writeFile("data/supplier-policies.json",JSON.stringify(policies,null,2)+"\n");
console.log(JSON.stringify({verifiedAt,results},null,2));