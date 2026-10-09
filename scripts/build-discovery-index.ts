import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {normalizeName} from "../src/domain/matching/normalization";
import type {CanonicalProduct,SupplierOffer} from "../src/types/domain";
import type {SearchSupplierId} from "../src/connectors/live-supplier-registry";
import {readDiscoveryState} from "./discovery-lib";

interface Seed {productId:string;supplierId:SearchSupplierId;url:string;}
interface History {productId?:string;supplierId:string;supplierSku?:string;sourceUrl?:string;presentation?:string;quantity?:number;unit?:string;packCount?:number;}
interface DiscoveryIndexEntry {
  supplierId:string;
  productUrl:string;
  rawName:string;
  normalizedName:string;
  supplierSku?:string;
  manufacturer?:string;
  manufacturerReference?:string;
  eanGtin?:string;
  variant?:string;
  shade?:string;
  presentation?:string;
  quantity?:number;
  unit?:string;
  packCount?:number;
  source:"current-price"|"history"|"seed"|"offline-discovery";
  sourceUrl?:string;
  firstSeenAt?:string;
  lastSeenAt?:string;
  discoveryStatus?:string;
  observedAt?:string;
}

const output=process.env.DISCOVERY_INDEX_OUT??"data/live-discovery-index.json";
const products=JSON.parse(readFileSync("data/products.json","utf8")) as CanonicalProduct[];
const current=JSON.parse(readFileSync("data/current-prices.json","utf8")) as SupplierOffer[];
const history=JSON.parse(readFileSync("data/price-history.json","utf8")) as History[];
const seeds=JSON.parse(readFileSync("data/supplier-seeds.json","utf8")) as Seed[];
const offlineState=readDiscoveryState("data/discovery-source-state.json");
const productsById=new Map(products.map(product=>[product.id,product]));

function productName(product?:CanonicalProduct){
  if(!product)return undefined;
  return [product.family,product.productName,product.shade,product.variant,product.presentation,product.quantity,product.unit]
    .filter(value=>value!==undefined&&value!==""&&value!==0).join(" ");
}

function key(entry:DiscoveryIndexEntry){
  return [
    entry.supplierId,
    entry.productUrl.split("#")[0],
    entry.supplierSku??"",
    entry.manufacturerReference??"",
    entry.rawName
  ].join("|");
}

function normalizeEntry(entry:DiscoveryIndexEntry):DiscoveryIndexEntry|undefined{
  if(!entry.productUrl||!/^https:\/\//i.test(entry.productUrl))return undefined;
  const rawName=entry.rawName.replace(/\s+/g," ").trim();
  if(!rawName||rawName.length<3)return undefined;
  return {
    ...entry,
    rawName,
    normalizedName:normalizeName([rawName,entry.manufacturer??"",entry.manufacturerReference??"",entry.supplierSku??""].join(" "))
  };
}

const byKey=new Map<string,DiscoveryIndexEntry>();
const add=(entry:DiscoveryIndexEntry)=>{
  const normalized=normalizeEntry(entry);
  if(!normalized)return;
  const k=key(normalized);
  const previous=byKey.get(k);
  if(!previous||previous.source==="seed"&&normalized.source!=="seed"||previous.source==="history"&&normalized.source==="current-price"){
    byKey.set(k,normalized);
  }
};

for(const offer of current){
  add({
    supplierId:offer.supplierId,
    productUrl:offer.productUrl,
    rawName:offer.rawName,
    normalizedName:offer.normalizedName,
    supplierSku:offer.supplierSku,
    manufacturer:offer.manufacturer,
    manufacturerReference:offer.manufacturerReference,
    eanGtin:offer.eanGtin,
    variant:offer.variant,
    shade:offer.shade,
    presentation:offer.presentation,
    quantity:offer.quantity,
    unit:offer.unit,
    packCount:offer.packCount,
    source:"current-price",
    observedAt:offer.observedAt
  });
}

for(const item of history){
  const product=item.productId?productsById.get(item.productId):undefined;
  if(!item.sourceUrl||!product)continue;
  add({
    supplierId:item.supplierId,
    productUrl:item.sourceUrl,
    rawName:productName(product)??item.productId??item.sourceUrl,
    normalizedName:"",
    supplierSku:item.supplierSku,
    manufacturer:product.manufacturer,
    manufacturerReference:product.manufacturerReference,
    eanGtin:product.eanGtin,
    variant:product.variant,
    shade:product.shade,
    presentation:item.presentation??product.presentation,
    quantity:item.quantity??product.quantity,
    unit:item.unit??product.unit,
    packCount:item.packCount??product.packCount,
    source:"history"
  });
}

for(const seed of seeds){
  const product=productsById.get(seed.productId);
  if(!product)continue;
  add({
    supplierId:seed.supplierId,
    productUrl:seed.url,
    rawName:productName(product)??seed.productId,
    normalizedName:"",
    manufacturer:product.manufacturer,
    manufacturerReference:product.manufacturerReference,
    eanGtin:product.eanGtin,
    variant:product.variant,
    shade:product.shade,
    presentation:product.presentation,
    quantity:product.quantity,
    unit:product.unit,
    packCount:product.packCount,
    source:"seed"
  });
}

for(const discovered of offlineState.products){
  if(discovered.discoveryStatus==="retired")continue;
  add({
    supplierId:discovered.supplierId,
    productUrl:discovered.productUrl,
    rawName:discovered.rawName,
    normalizedName:discovered.normalizedName,
    supplierSku:discovered.supplierSku,
    manufacturer:discovered.manufacturer,
    manufacturerReference:discovered.manufacturerReference,
    eanGtin:discovered.eanGtin,
    variant:discovered.variant,
    shade:discovered.shade,
    presentation:discovered.presentation,
    quantity:discovered.quantity,
    unit:discovered.unit,
    packCount:discovered.packCount,
    source:"offline-discovery",
    sourceUrl:discovered.sourceUrl,
    firstSeenAt:discovered.firstSeenAt,
    lastSeenAt:discovered.lastSeenAt,
    discoveryStatus:discovered.discoveryStatus
  });
}

const entries=[...byKey.values()].sort((a,b)=>a.supplierId.localeCompare(b.supplierId)||a.rawName.localeCompare(b.rawName));
const report={
  generatedAt:new Date().toISOString(),
  sourceCounts:{
    currentPrices:current.length,
    history:history.length,
    seeds:seeds.length,
    offlineDiscovery:offlineState.products.filter(product=>product.discoveryStatus!=="retired").length
  },
  sourceReports:offlineState.sources,
  entries
};

mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({entries:entries.length,output},null,2));
