import { healthCheckDentaltix } from "../src/connectors/dentaltix";
import { healthCheckProclinic } from "../src/connectors/proclinic";
import { healthCheckDentalIberica } from "../src/connectors/dental-iberica";
import { healthCheckDentalCost } from "../src/connectors/dentalcost";
import { healthCheckDvd } from "../src/connectors/dvd-dental";
import { healthCheckDentalExpress } from "../src/connectors/dentalexpress";
import { healthCheckBrokerDental } from "../src/connectors/brokerdental";
import { healthCheckOrtolan } from "../src/connectors/ortolan";

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
  healthCheckDvd(undefined,timedFetch),
  healthCheckDentalExpress(undefined,timedFetch),
  healthCheckBrokerDental(undefined,timedFetch),
  healthCheckOrtolan(undefined,timedFetch)
]);
const suppliers=["dentaltix","proclinic","dental-iberica","dentalcost","dvd-dental","dentalexpress","brokerdental","ortolan"];
console.log(JSON.stringify(results.map((result,index)=>({supplierId:suppliers[index],...result})),null,2));