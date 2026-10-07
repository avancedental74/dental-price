import { healthCheckDentaltix } from "../src/connectors/dentaltix";
import { healthCheckProclinic } from "../src/connectors/proclinic";
import { healthCheckDentalIberica } from "../src/connectors/dental-iberica";
import { healthCheckDentalCost } from "../src/connectors/dentalcost";
import { healthCheckDvd } from "../src/connectors/dvd-dental";

const timedFetch:typeof fetch=async(input,init={})=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{return await fetch(input,{...init,signal:controller.signal});}
  finally{clearTimeout(timer);}
};

const results=await Promise.all([
  healthCheckDentaltix(undefined,timedFetch),
  healthCheckProclinic(undefined,timedFetch),
  healthCheckDentalIberica(undefined,timedFetch),
  healthCheckDentalCost(undefined,timedFetch),
  healthCheckDvd(undefined,timedFetch)
]);
const suppliers=["dentaltix","proclinic","dental-iberica","dentalcost","dvd-dental"];
console.log(JSON.stringify(results.map((r,i)=>({supplierId:suppliers[i],...r})),null,2));