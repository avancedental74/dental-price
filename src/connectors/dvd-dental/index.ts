import { parseDvdProductHtml } from "./parser";
import { normalizeDvd } from "./normalizer";
import type { DvdConnectorResult, DvdHealth } from "./types";
const USER_AGENT="DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)";
export async function fetchDvdProduct(productUrl:string,fetchImpl:typeof fetch=fetch):Promise<DvdConnectorResult>{
 const response=await fetchImpl(productUrl,{headers:{"user-agent":USER_AGENT,accept:"text/html,application/xhtml+xml"}});
 if(!response.ok) throw new Error("DVD Dental HTTP "+response.status);
 const raw=parseDvdProductHtml(await response.text(),productUrl);return{raw,offers:normalizeDvd(raw)};
}
export async function healthCheckDvd(url="https://www.dvd-dental.com/composite-filtek-supreme-xte-jeringas-3g/",fetchImpl:typeof fetch=fetch):Promise<DvdHealth>{
 const checkedAt=new Date().toISOString();try{const r=await fetchDvdProduct(url,fetchImpl);return r.offers.length?{status:"green",checkedAt,message:r.offers.length+" oferta(s) normalizada(s)"}:{status:"amber",checkedAt,message:"Página accesible pero parser incompleto"};}catch(e){return{status:"red",checkedAt,message:e instanceof Error?e.message:"Error desconocido"};}
}
