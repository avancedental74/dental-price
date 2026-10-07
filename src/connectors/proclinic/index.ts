import { parseProclinicProductHtml } from "./parser";
import { normalizeProclinic } from "./normalizer";
import type { ProclinicConnectorResult, ProclinicHealth } from "./types";

const USER_AGENT="DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)";

export async function fetchProclinicProduct(productUrl:string, fetchImpl:typeof fetch=fetch):Promise<ProclinicConnectorResult>{
  const response=await fetchImpl(productUrl,{headers:{"user-agent":USER_AGENT,accept:"text/html,application/xhtml+xml"}});
  if(!response.ok) throw new Error("Proclinic HTTP "+response.status);
  const raw=parseProclinicProductHtml(await response.text(),productUrl);
  return {raw,offers:normalizeProclinic(raw)};
}

export async function healthCheckProclinic(url="https://www.proclinic.es/tienda/filtek-supreme-xte-kit-jeringas.html",fetchImpl:typeof fetch=fetch):Promise<ProclinicHealth>{
  const checkedAt=new Date().toISOString();
  try {
    const result=await fetchProclinicProduct(url,fetchImpl);
    if(!result.raw.title || result.offers.length===0) return {status:"amber",checkedAt,message:"Página accesible pero parser incompleto"};
    return {status:"green",checkedAt,message:result.offers.length+" oferta(s) normalizada(s)"};
  } catch(error) {
    const message=error instanceof Error ? error.message : "Error desconocido";
    if(message.includes("HTTP 405")) return {status:"amber",checkedAt,message:"Acceso automatizado no disponible (HTTP 405); se conserva el último snapshot verificado"};
    return {status:"red",checkedAt,message};
  }
}