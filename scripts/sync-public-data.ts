import { mkdir, copyFile, access } from "node:fs/promises";

const files=["products.json","current-prices.json","price-history.json","connector-status.json"];
await mkdir("public/data",{recursive:true});
for(const file of files){
  try{
    await access(`data/${file}`);
    await copyFile(`data/${file}`,`public/data/${file}`);
  }catch{
    if(file==="products.json") throw new Error("data/products.json is required");
  }
}
console.log("Public data synchronized");