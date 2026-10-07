import { healthCheckDentaltix } from "../src/connectors/dentaltix";
import { healthCheckProclinic } from "../src/connectors/proclinic";
import { healthCheckDentalIberica } from "../src/connectors/dental-iberica";
import { healthCheckDentalCost } from "../src/connectors/dentalcost";
import { healthCheckDvd } from "../src/connectors/dvd-dental";

const results=await Promise.all([
  healthCheckDentaltix(),
  healthCheckProclinic(),
  healthCheckDentalIberica(),
  healthCheckDentalCost(),
  healthCheckDvd()
]);
const suppliers=["dentaltix","proclinic","dental-iberica","dentalcost","dvd-dental"];
console.log(JSON.stringify(results.map((r,i)=>({supplierId:suppliers[i],...r})),null,2));