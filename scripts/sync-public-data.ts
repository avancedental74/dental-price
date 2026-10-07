import { mkdir, copyFile } from "node:fs/promises";

await mkdir("public/data",{recursive:true});
for(const name of ["products.json","current-prices.json","price-history.json","connector-status.json"]){
  await copyFile("data/"+name,"public/data/"+name);
}
console.log("Public data synchronized");