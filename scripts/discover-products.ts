import {mkdirSync,writeFileSync} from "node:fs";
import {dirname} from "node:path";
import {
  cleanText,
  manufacturerReferenceFromText,
  mergeDiscoveryState,
  readDiscoveryState,
  slugTitle,
  type DiscoveredCandidate,
  type OfflineDiscoveryState
} from "./discovery-lib";
import type {SearchSupplierId} from "../src/connectors/live-supplier-registry";

const USER_AGENT="DentalPrice/0.2 (+https://github.com/avancedental74/dental-price; offline discovery; single-user)";
const output=process.env.DISCOVERY_STATE_OUT??"data/discovery-source-state.json";
const maxPerProvider=Number(process.env.DISCOVERY_MAX_PER_PROVIDER??"25");
const maxPages=Number(process.env.DISCOVERY_MAX_PAGES??"2");
const now=new Date().toISOString();

interface SourceConfig {
  supplierId:SearchSupplierId;
  kind:"sitemap"|"woocommerce-store-api";
  url:string;
  productUrlPattern:RegExp;
  scope:"full"|"partial";
}

const sources:SourceConfig[]=[
  {
    supplierId:"dentaltix",
    kind:"sitemap",
    url:"https://www.dentaltix.com/sitemap_index.xml",
    productUrlPattern:/\/(?:es\/)?productos-[^/?#]+/i,
    scope:"partial"
  },
  {
    supplierId:"dentalcost",
    kind:"sitemap",
    url:"https://www.dentalcost.es/es_0_sitemap_1.xml",
    productUrlPattern:/\/\d+-[^/?#]+\.html$/i,
    scope:"partial"
  },
  {
    supplierId:"dentalexpress",
    kind:"sitemap",
    url:"https://dentalexpress.es/media/sitemap/sitemap_dees.xml",
    productUrlPattern:/\/[^/?#]+\.html$/i,
    scope:"partial"
  },
  {
    supplierId:"ortolan",
    kind:"sitemap",
    url:"https://ortolan.es/1_index_sitemap.xml",
    productUrlPattern:/\/(?:es|en|fr)\/[^/?#]+\/\d+-[^/?#]+\.html$/i,
    scope:"partial"
  },
  {
    supplierId:"dentipak",
    kind:"sitemap",
    url:"https://www.dentipak.com/sitemap.xml",
    productUrlPattern:/\/(?:producto|product|shop)\//i,
    scope:"partial"
  },
  {
    supplierId:"dentalboom",
    kind:"woocommerce-store-api",
    url:"https://dentalboom.com/wp-json/wc/store/v1/products",
    productUrlPattern:/\/shop\//i,
    scope:"partial"
  }
];

function validUrl(value:string){
  try{return new URL(value).protocol==="https:";}catch{return false;}
}

async function fetchText(url:string){
  const response=await fetch(url,{headers:{"user-agent":USER_AGENT,accept:"application/xml,text/xml,text/plain,text/html,application/json"}});
  if(!response.ok)throw new Error("HTTP "+response.status);
  return response.text();
}

function xmlValue(value:string){
  return value.trim().replace(/^<!\[CDATA\[/,"").replace(/\]\]>$/,"").replace(/&amp;/g,"&");
}

function parseLocs(xml:string){
  return [...xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)].map(match=>xmlValue(match[1]));
}

function parseUrlBlocks(xml:string){
  return [...xml.matchAll(/<url>\s*([\s\S]*?)\s*<\/url>/gi)].map(match=>match[1]);
}

function firstTag(block:string,tag:string){
  const escaped=tag.replace(":","\\:");
  const match=block.match(new RegExp(`<${escaped}>\\s*([\\s\\S]*?)\\s*<\\/${escaped}>`,"i"));
  return match?xmlValue(match[1]):undefined;
}

async function discoverFromSitemap(config:SourceConfig){
  const candidates:DiscoveredCandidate[]=[];
  const visited:string[]=[];
  const queue=[config.url];
  while(queue.length&&visited.length<maxPages&&candidates.length<maxPerProvider){
    const url=queue.shift()!;
    visited.push(url);
    const xml=await fetchText(url);
    const blocks=parseUrlBlocks(xml);
    const locItems=blocks.length
      ?blocks.map(block=>({loc:firstTag(block,"loc"),title:firstTag(block,"image:title")??firstTag(block,"video:title")}))
      :parseLocs(xml).map(loc=>({loc,title:undefined as string|undefined}));
    for(const item of locItems){
      if(candidates.length>=maxPerProvider)break;
      const loc=item.loc;
      if(!loc||!validUrl(loc))continue;
      if(/\.xml(?:\.gz)?$/i.test(new URL(loc).pathname)){
        if(queue.length+visited.length<maxPages)queue.push(loc);
        continue;
      }
      if(!config.productUrlPattern.test(new URL(loc).pathname))continue;
      candidates.push({
        supplierId:config.supplierId,
        productUrl:loc,
        rawName:item.title??slugTitle(loc),
        source:"sitemap",
        sourceUrl:url,
        detailStatus:"not_fetched"
      });
    }
  }
  return {candidates,visited};
}

interface WooProduct {
  name?:string;
  permalink?:string;
  sku?:string;
  description?:string;
  short_description?:string;
  brands?:Array<{name?:string}>;
}

async function discoverFromWooStoreApi(config:SourceConfig){
  const candidates:DiscoveredCandidate[]=[];
  const visited:string[]=[];
  for(let page=1;page<=maxPages&&candidates.length<maxPerProvider;page++){
    const url=`${config.url}?per_page=${Math.min(25,maxPerProvider)}&page=${page}`;
    visited.push(url);
    const response=await fetch(url,{headers:{"user-agent":USER_AGENT,accept:"application/json"}});
    if(!response.ok)throw new Error("HTTP "+response.status);
    const products=await response.json() as WooProduct[];
    if(!Array.isArray(products)||products.length===0)break;
    for(const product of products){
      if(candidates.length>=maxPerProvider)break;
      if(!product.permalink||!validUrl(product.permalink))continue;
      const hay=[product.description,product.short_description,product.name].filter(Boolean).join(" ");
      candidates.push({
        supplierId:config.supplierId,
        productUrl:product.permalink,
        rawName:cleanText(product.name??slugTitle(product.permalink)),
        supplierSku:product.sku,
        manufacturer:product.brands?.map(brand=>brand.name).find(Boolean),
        manufacturerReference:manufacturerReferenceFromText(hay),
        source:"store-api",
        sourceUrl:url,
        detailStatus:"fetched"
      });
    }
  }
  return {candidates,visited};
}

async function discover(config:SourceConfig){
  if(config.kind==="woocommerce-store-api")return discoverFromWooStoreApi(config);
  return discoverFromSitemap(config);
}

const previous=readDiscoveryState(output);
const allCandidates:DiscoveredCandidate[]=[];
const sourceReports:OfflineDiscoveryState["sources"]=[];

for(const config of sources){
  const sourceStarted=new Date().toISOString();
  try{
    const result=await discover(config);
    allCandidates.push(...result.candidates);
    sourceReports.push({
      supplierId:config.supplierId,
      source:config.kind,
      sourceUrl:config.url,
      fetchedAt:sourceStarted,
      status:result.candidates.length?"ok":"partial",
      scope:config.scope,
      discovered:result.candidates.length
    });
  }catch(error){
    sourceReports.push({
      supplierId:config.supplierId,
      source:config.kind,
      sourceUrl:config.url,
      fetchedAt:sourceStarted,
      status:"error",
      scope:config.scope,
      discovered:0,
      error:error instanceof Error?error.message:"DISCOVERY_ERROR"
    });
  }
}

const next=mergeDiscoveryState(previous,allCandidates,sourceReports,now);
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(next,null,2));

const previousKeys=new Set(previous.products.map(product=>product.supplierId+"|"+product.productUrl));
const newProducts=next.products.filter(product=>!previousKeys.has(product.supplierId+"|"+product.productUrl));
const bySupplier=Object.fromEntries(sourceReports.map(source=>[source.supplierId,{status:source.status,discovered:source.discovered,error:source.error}]));
console.log(JSON.stringify({output,products:next.products.length,newProducts:newProducts.length,bySupplier},null,2));
