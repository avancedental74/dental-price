import { parseDentalCostProductHtml } from "./parser";
import { normalizeDentalCost } from "./normalizer";
import type { DentalCostConnectorResult, DentalCostHealth } from "./types";

const USER_AGENT="DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)";
export async function fetchDentalCostProduct(productUrl:string,fetchImpl:typeof fetch=fetch):Promise<DentalCostConnectorResult>{
  const response=await fetchImpl(productUrl,{headers:{"user-agent":USER_AGENT,accept:"text/html,application/xhtml+xml"}});
  if(!response.ok) throw new Error("DentalCost HTTP "+response.status);
  const raw=parseDentalCostProductHtml(await response.text(),productUrl);
  return {raw,offers:normalizeDentalCost(raw)};
}
export async function healthCheckDentalCost(url="https://www.dentalcost.es/composites-universales/687-filtek-supreme-xte-composite-universal-body-3gr.html",fetchImpl:typeof fetch=fetch):Promise<DentalCostHealth>{
  const checkedAt=new Date().toISOString();
  try{const r=await fetchDentalCostProduct(url,fetchImpl);return r.offers.length?{status:"green",checkedAt,message:r.offers.length+" oferta(s) normalizada(s)"}:{status:"amber",checkedAt,message:"Página accesible pero parser incompleto"};}
  catch(e){return {status:"red",checkedAt,message:e instanceof Error?e.message:"Error desconocido"};}
}
