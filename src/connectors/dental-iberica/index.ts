import { parseDentalIbericaProductHtml } from "./parser";
import { normalizeDentalIberica } from "./normalizer";
import type { DentalIbericaConnectorResult, DentalIbericaHealth } from "./types";

const USER_AGENT="DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)";

export async function fetchDentalIbericaProduct(productUrl:string,fetchImpl:typeof fetch=fetch):Promise<DentalIbericaConnectorResult>{
  const response=await fetchImpl(productUrl,{headers:{"user-agent":USER_AGENT,accept:"text/html,application/xhtml+xml"}});
  if(!response.ok) throw new Error("Dental Iberica HTTP "+response.status);
  const raw=parseDentalIbericaProductHtml(await response.text(),productUrl);
  return {raw,offers:normalizeDentalIberica(raw)};
}

export async function healthCheckDentalIberica(url="https://dentaliberica.com/es/filtek-z250-capsula-20-x-02-g",fetchImpl:typeof fetch=fetch):Promise<DentalIbericaHealth>{
  const checkedAt=new Date().toISOString();
  try{
    const result=await fetchDentalIbericaProduct(url,fetchImpl);
    if(!result.raw.title || result.offers.length===0) return {status:"amber",checkedAt,message:"Página accesible pero parser incompleto"};
    return {status:"green",checkedAt,message:result.offers.length+" oferta(s) normalizada(s)"};
  }catch(error){
    const message=error instanceof Error?error.message:"Error desconocido";
    if(message.includes("HTTP 405")) return {status:"amber",checkedAt,message:"Acceso automatizado no disponible (HTTP 405); se conserva el último snapshot verificado"};
    return {status:"red",checkedAt,message};
  }
}