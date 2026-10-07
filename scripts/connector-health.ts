import { writeFile, mkdir, copyFile } from "node:fs/promises";
import { healthCheckDentaltix } from "../src/connectors/dentaltix";
import { healthCheckProclinic } from "../src/connectors/proclinic";
import { healthCheckDentalIberica } from "../src/connectors/dental-iberica";

const [dentaltix,proclinic,dentalIberica]=await Promise.all([
  healthCheckDentaltix(),
  healthCheckProclinic(),
  healthCheckDentalIberica()
]);
const generatedAt=new Date().toISOString();
const payload={generatedAt,suppliers:{dentaltix,proclinic,"dental-iberica":dentalIberica}};
await writeFile("data/connector-status.json",JSON.stringify(payload,null,2)+"\n");
await mkdir("public/data",{recursive:true});
await copyFile("data/connector-status.json","public/data/connector-status.json");
if([dentaltix,proclinic,dentalIberica].every(x=>x.status==="red")) process.exitCode=1;
console.log(JSON.stringify(payload,null,2));