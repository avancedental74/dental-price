import { writeFile } from "node:fs/promises";
import { healthCheckDentaltix } from "../src/connectors/dentaltix";
import { healthCheckProclinic } from "../src/connectors/proclinic";
import { healthCheckDentalIberica } from "../src/connectors/dental-iberica";

const results=await Promise.all([
  healthCheckDentaltix(),
  healthCheckProclinic(),
  healthCheckDentalIberica()
]);
await writeFile("data/connector-status.json",JSON.stringify(results.map((r,i)=>({supplierId:["dentaltix","proclinic","dental-iberica"][i],...r})),null,2)+"\n");
console.log(JSON.stringify(results,null,2));