import * as cheerio from "cheerio";
import { normalizeName, normalizeReference } from "../domain/matching/normalization";
import type { SearchSupplierId } from "./live-supplier-registry";
export type { SearchSupplierId } from "./live-supplier-registry";

const configs:Record<SearchSupplierId,{origin:string;home:string;templates:string[]}>={
  dentaltix:{origin:"https://www.dentaltix.com",home:"https://www.dentaltix.com/es",templates:[
    "https://www.dentaltix.com/es/search-results?q={q}"
  ]},
  dentalcost:{origin:"https://www.dentalcost.es",home:"https://www.dentalcost.es/",templates:[
    "https://www.dentalcost.es/buscar?s={q}","https://www.dentalcost.es/?controller=search&search_query={q}"
  ]},
  "dvd-dental":{origin:"https://www.dvd-dental.com",home:"https://www.dvd-dental.com/",templates:[
    "https://www.dvd-dental.com/search.php?search_query={q}"
  ]},
  proclinic:{origin:"https://www.proclinic.es",home:"https://www.proclinic.es/tienda/",templates:[
    "https://www.proclinic.es/tienda/catalogsearch/result/?q={q}","https://www.proclinic.es/tienda/search?q={q}","https://www.proclinic.es/tienda/buscar?q={q}"
  ]},
  "dental-iberica":{origin:"https://dentaliberica.com",home:"https://dentaliberica.com/",templates:[
    "https://dentaliberica.com/?s={q}&post_type=product","https://dentaliberica.com/search?controller=search&s={q}"
  ]},
  dentalexpress:{origin:"https://dentalexpress.es",home:"https://dentalexpress.es/",templates:[
    "https://dentalexpress.es/catalogsearch/result/?q={q}","https://dentalexpress.es/search?controller=search&s={q}"
  ]},
  brokerdental:{origin:"https://www.brokerdental.es",home:"https://www.brokerdental.es/",templates:[
    "https://www.brokerdental.es/catalogsearch/result/?q={q}","https://www.brokerdental.es/search?controller=search&s={q}"
  ]},
  ortolan:{origin:"https://ortolan.es",home:"https://ortolan.es/es/",templates:[
    "https://ortolan.es/es/busqueda?controller=search&s={q}"
  ]},
  dentipak:{origin:"https://www.dentipak.es",home:"https://www.dentipak.es/shop",templates:[
    "https://www.dentipak.es/shop?search={q}"
  ]},
  dentalboom:{origin:"https://dentalboom.com",home:"https://dentalboom.com/",templates:[
    "https://dentalboom.com/?s={q}&post_type=product"
  ]}
};

const deniedParts=["/login","/registro","/cart","/carrito","/checkout","/contact","/contacto","/blog","/category","/categoria","/marca","/brand","javascript:"];
const searchRouteParts=["/search-results","/search.php","/catalogsearch/result","/busqueda","/buscar","/search?","/search/","?s="];

function isSearchOrNavigationUrl(url:string,base:string):boolean{
  try{
    const u=new URL(url),b=new URL(base);
    if(u.toString()===b.toString())return true;
    const pathQuery=(u.pathname+u.search).toLowerCase();
    return searchRouteParts.some(part=>pathQuery.includes(part));
  }catch{return true;}
}

function scoreLink(text:string,href:string,query:string):number{
  const q=normalizeName(query);
  let hrefIdentity=href;
  try{
    const u=new URL(href);
    // Search engines often echo the user's query in every result URL.
    // Scoring query/hash would make every unrelated result look relevant.
    hrefIdentity=u.origin+u.pathname;
  }catch{ /* non-URL strings are scored as provided */ }
  const hay=normalizeName(text+" "+hrefIdentity);
  const compact=normalizeReference(query)??"";
  const normalizedHay=normalizeReference(hay)??"";
  let score=0;
  if(compact&&normalizedHay.includes(compact))score+=12;
  const tokens=q.split(" ").filter(t=>t.length>=2);
  for(const token of tokens)if(hay.includes(token))score+=token.length>=5?3:1;
  if(/product|producto|html|\/es\//i.test(href))score+=1;
  return score;
}

function extractProductLinks(html:string,base:string,origin:string,query:string,maxResults:number){
  const $=cheerio.load(html);
  const found=new Map<string,{url:string;score:number}>();
  const productSelectors=(origin.includes("ortolan.es")
    ? ['article[data-id-product] a[href]']
    : [
      '[data-testid="product-card"] a[href]',
      '.product-item a[href]',
      '.product-items a[href]',
      '.product-miniature a[href]',
      'article[data-id-product] a[href]',
      '.product-container a[href]',
      '.product-title a[href]',
      'a.product-item-link[href]',
      'li.ajax_block_product a[href]',
      '.ajax_block_product a[href]'
    ]).join(",");
  const productUrls=new Set<string>();
  $(productSelectors).each((_,el)=>{
    const raw=$(el).attr("href")??"";
    try{
      const url=new URL(raw,base).toString();
      if(!raw.startsWith("#")&&new URL(url).origin===new URL(origin).origin&&!deniedParts.some(x=>url.toLowerCase().includes(x))&&!isSearchOrNavigationUrl(url,base))productUrls.add(url);
    }catch{ /* ignore invalid result link */ }
  });
  $("a[href]").each((_,el)=>{
    const raw=$(el).attr("href")??"";
    const text=$(el).text().replace(/\s+/g," ").trim();
    if(!raw||raw.startsWith("#")||deniedParts.some(x=>raw.toLowerCase().includes(x)))return;
    let url:string;
    try{url=new URL(raw,base).toString();}catch{return;}
    if(new URL(url).origin!==new URL(origin).origin)return;
    if(url===base||url.endsWith("/")||isSearchOrNavigationUrl(url,base))return;
    const isProductResult=productUrls.has(url);
    const cardText=isProductResult
      ?$(el).closest('article,li.ajax_block_product,.product-item,.product-miniature,.product-container').first().text().replace(/\s+/g," ").trim().slice(0,1200)
      :"";
    const baseScore=scoreLink([text,cardText].filter(Boolean).join(" "),url,query);
    if(origin.includes("ortolan.es")&&(!isProductResult||baseScore<2))return;
    const score=baseScore+(isProductResult?8:0);
    if(score<2)return;
    const previous=found.get(url);
    if(!previous||score>previous.score)found.set(url,{url,score});
  });
  return [...found.values()].sort((a,b)=>b.score-a.score).slice(0,maxResults).map(x=>x.url);
}

async function trySearchRequest(
  url:string,
  query:string,
  origin:string,
  fetchImpl:typeof fetch,
  maxResults:number,
  init:RequestInit={}
){
  const headers={...((init.headers as Record<string,string>|undefined)??{}),"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0 Safari/537.36",accept:"text/html,application/xhtml+xml"};
  const response=await fetchImpl(url,{...init,headers,redirect:"follow"});
  if(!response.ok)throw new Error("HTTP "+response.status);
  const html=await response.text();
  return {urls:extractProductLinks(html,response.url||url,origin,query,maxResults),html,responseUrl:response.url||url};
}

async function searchViaDetectedForm(cfg:{origin:string;home:string},query:string,fetchImpl:typeof fetch,maxResults:number){
  const home=await trySearchRequest(cfg.home,query,cfg.origin,fetchImpl,1);
  const $=cheerio.load(home.html);
  const forms=$("form").toArray();
  for(const form of forms){
    const inputs=$(form).find("input").toArray();
    const searchInput=inputs.find(input=>{
      const node=$(input);
      const clue=[node.attr("name"),node.attr("id"),node.attr("placeholder"),node.attr("type")].filter(Boolean).join(" ");
      return /search|buscar|busca|query|keyword|producto|referencia|q\b/i.test(clue)&&node.attr("type")!=="hidden";
    });
    if(!searchInput)continue;
    const name=$(searchInput).attr("name");
    if(!name)continue;
    const action=$(form).attr("action")||cfg.home;
    let target:string;
    try{target=new URL(action,home.responseUrl).toString();}catch{continue;}
    if(new URL(target).origin!==new URL(cfg.origin).origin)continue;
    const params=new URLSearchParams();
    for(const input of inputs){
      const node=$(input),n=node.attr("name"),type=node.attr("type");
      if(!n||n===name||type!=="hidden")continue;
      params.set(n,node.attr("value")??"");
    }
    params.set(name,query);
    const method=($(form).attr("method")||"GET").toUpperCase();
    try{
      const result=method==="POST"
        ?await trySearchRequest(target,query,cfg.origin,fetchImpl,maxResults,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:params.toString()})
        :await trySearchRequest(target+(target.includes("?")?"&":"?")+params.toString(),query,cfg.origin,fetchImpl,maxResults);
      if(result.urls.length)return {urls:result.urls,searchUrl:target};
    }catch{ /* ignored: fallback path continues */ }
  }
  return {urls:[] as string[]};
}

export interface DvdKlevuRecord {
  url?:string;
  name?:string;
  sku?:string;
  brand?:string;
  price?:string;
  salePrice?:string;
  basePrice?:string;
  inStock?:string;
  ["nº_pieza_fabricante"]?:string;
}

export async function searchDvdKlevuRecords(query:string,fetchImpl:typeof fetch=fetch,maxResults=5):Promise<DvdKlevuRecord[]>{
  const endpoint="https://eucs34v2.ksearchnet.com/cs/v2/search";
  const apiKey="klevu-174436997355118006";
  const body={
    context:{apiKeys:[apiKey]},
    recordQueries:[{
      id:"productSearch",
      typeOfRequest:"SEARCH",
      settings:{query:{term:query},limit:maxResults,typeOfRecords:["KLEVU_PRODUCT"]}
    }]
  };
  const response=await fetchImpl(endpoint,{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json"},
    body:JSON.stringify(body)
  });
  if(!response.ok)throw new Error("KLEVU_HTTP_"+response.status);
  const data=await response.json() as {queryResults?:Array<{records?:DvdKlevuRecord[]}>};
  return (data.queryResults?.flatMap(x=>x.records??[])??[])
    .filter(record=>record.url&&scoreLink([record.name,record.sku,record["nº_pieza_fabricante"]].filter(Boolean).join(" "),record.url!,query)>=2)
    .slice(0,maxResults);
}

export interface DentalBoomRecord {
  sku?:string;
  name:string;
  url:string;
}

export async function searchDentalBoomRecords(query:string,fetchImpl:typeof fetch=fetch,maxResults=5):Promise<DentalBoomRecord[]>{
  const url="https://dentalboom.com/wp-json/wc/store/v1/products?search="+encodeURIComponent(query);
  const response=await fetchImpl(url,{headers:{"user-agent":"Mozilla/5.0","accept":"application/json"}});
  if(!response.ok)throw new Error("DENTALBOOM_API_HTTP_"+response.status);
  const data=await response.json() as Array<{sku?:string;name?:string;permalink?:string}>;
  return data
    .filter(item=>item.name&&item.permalink&&scoreLink([item.name,item.sku].filter(Boolean).join(" "),item.permalink!,query)>=2)
    .slice(0,maxResults)
    .map(item=>({sku:item.sku,name:item.name!,url:item.permalink!}));
}

export interface OrtolanSearchRecord {
  supplierSku?:string;
  name:string;
  price:number;
  variant?:string;
  url?:string;
  stockQuantity?:number;
}

function decodeHtmlJson(value:string):string{
  return value.replace(/\\u([0-9a-f]{4})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/\\\//g,"/");
}

async function expandOrtolanProductVariants(
  productUrl:string,
  productName:string,
  query:string,
  fetchImpl:typeof fetch,
  maxResults:number
):Promise<OrtolanSearchRecord[]>{
  const detailUrl=productUrl.split("#")[0]!;
  const response=await fetchImpl(detailUrl,{
    headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0 Safari/537.36",accept:"text/html,application/xhtml+xml"},
    redirect:"follow"
  });
  if(!response.ok)return [];
  const html=await response.text();
  const records:OrtolanSearchRecord[]=[];
  const seen=new Set<string>();
  const variantRe=/"id_product_attribute":\d+,"id_product":\d+,"reference":"([^"]*)"[^{}]{0,2200}?"price":([0-9]+(?:\.[0-9]+)?)[^{}]{0,2200}?"attribute_designation":"([^"]*)"[^{}]{0,1200}?"quantity":(-?\d+)/g;
  for(const match of html.matchAll(variantRe)){
    const supplierSku=decodeHtmlJson(match[1]??"").trim()||undefined;
    const price=Number(match[2]);
    const designation=decodeHtmlJson(match[3]??"").trim();
    const color=designation.match(/Color\s*-\s*(.*?)(?=,\s*Formato\s*-|$)/i)?.[1]?.trim();
    const format=designation.match(/Formato\s*-\s*(.*)$/i)?.[1]?.trim();
    const variant=[color,format].filter(Boolean).join(" - ")||designation;
    const stockQuantity=Number(match[4]);
    if(!supplierSku||!Number.isFinite(price)||price<=0||!variant)continue;
    const hay=[productName,variant,supplierSku].join(" ");
    const score=scoreLink(hay,hay,query);
    if(score<2)continue;
    if(seen.has(supplierSku))continue;
    seen.add(supplierSku);
    records.push({supplierSku,name:productName,price,variant,url:detailUrl,stockQuantity:Number.isFinite(stockQuantity)?stockQuantity:undefined});
  }
  return records
    .sort((a,b)=>scoreLink([b.name,b.variant,b.supplierSku].filter(Boolean).join(" "),"",query)-scoreLink([a.name,a.variant,a.supplierSku].filter(Boolean).join(" "),"",query))
    .slice(0,maxResults);
}

export async function searchOrtolanRecords(query:string,fetchImpl:typeof fetch=fetch,maxResults=8):Promise<OrtolanSearchRecord[]>{
  const searchUrl="https://ortolan.es/es/busqueda?controller=search&s="+encodeURIComponent(query);
  const response=await fetchImpl(searchUrl,{
    headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0 Safari/537.36",accept:"text/html,application/xhtml+xml"},
    redirect:"follow"
  });
  if(!response.ok)throw new Error("ORTOLAN_SEARCH_HTTP_"+response.status);
  const html=await response.text();
  const $=cheerio.load(html);
  const urlsByProduct=new Map<string,string>();
  const namesByProduct=new Map<string,string>();
  $('article[data-id-product]').each((_,el)=>{
    const id=$(el).attr("data-id-product");
    const href=$(el).find('a[href*=".html"]').first().attr("href");
    const name=$(el).find(".product-title").first().text().replace(/\s+/g," ").trim();
    if(id&&href){
      try{urlsByProduct.set(id,new URL(href,response.url||searchUrl).toString());}catch{ /* ignore */ }
      if(name)namesByProduct.set(id,name);
    }
  });

  const defaultRecords:OrtolanSearchRecord[]=[];
  const seen=new Set<string>();
  for(const match of html.matchAll(/"item_id":"([^"]+)","item_name":"([^"]+)"[^{}]{0,700}?"price":([0-9]+(?:\.[0-9]+)?)[^{}]{0,700}?"item_variant":"([^"]*)"/g)){
    const supplierSku=match[1];
    const name=decodeHtmlJson(match[2]??"");
    const price=Number(match[3]);
    const variant=decodeHtmlJson(match[4]??"")||undefined;
    if(!Number.isFinite(price)||price<=0)continue;
    const hay=[name,variant,supplierSku].filter(Boolean).join(" ");
    if(scoreLink(hay,hay,query)<2)continue;
    const baseId=supplierSku?.split("-")[0];
    const key=[supplierSku,name,variant].join("|");
    if(seen.has(key))continue;
    seen.add(key);
    defaultRecords.push({supplierSku,name,price,variant,url:baseId?urlsByProduct.get(baseId):undefined});
  }

  const top=defaultRecords.find(record=>record.url);
  if(top?.url){
    try{
      const baseId=top.supplierSku?.split("-")[0];
      const expanded=await expandOrtolanProductVariants(top.url,namesByProduct.get(baseId??"")??top.name,query,fetchImpl,maxResults);
      if(expanded.length)return expanded;
    }catch{ /* fall back to lightweight search result */ }
  }
  return defaultRecords.slice(0,maxResults);
}

async function searchDvdKlevu(query:string,fetchImpl:typeof fetch,maxResults:number){
  const records=await searchDvdKlevuRecords(query,fetchImpl,maxResults);
  return [...new Set(records.map(record=>record.url!).filter(Boolean))];
}

async function searchViaSitemap(cfg:{origin:string},query:string,fetchImpl:typeof fetch,maxResults:number){
  const candidates=[cfg.origin+"/sitemap.xml",cfg.origin+"/sitemap_index.xml"];
  const locs:string[]=[];
  for(const sitemap of candidates){
    try{
      const response=await fetchImpl(sitemap,{headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0 Safari/537.36","accept":"application/xml,text/xml,text/plain"}});
      if(!response.ok)continue;
      const xml=await response.text();
      const $=cheerio.load(xml,{xmlMode:true});
      const top=$("loc").toArray().map(x=>$(x).text().trim()).filter(Boolean);
      const child=top.filter(x=>/sitemap/i.test(x)).slice(0,4);
      if(child.length){
        for(const childUrl of child){
          try{
            const cr=await fetchImpl(childUrl,{headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0 Safari/537.36","accept":"application/xml,text/xml,text/plain"}});
            if(!cr.ok)continue;
            const cx=cheerio.load(await cr.text(),{xmlMode:true});
            locs.push(...cx("loc").toArray().map(x=>cx(x).text().trim()).filter(Boolean));
          }catch{ /* ignored: fallback path continues */ }
        }
      }else locs.push(...top);
      if(locs.length)break;
    }catch{ /* ignored: fallback path continues */ }
  }
  return [...new Set(locs)]
    .map(url=>({url,score:scoreLink(url,url,query)}))
    .filter(x=>x.score>=2)
    .sort((a,b)=>b.score-a.score)
    .slice(0,maxResults)
    .map(x=>x.url);
}

export async function discoverSupplierProductUrls(
  supplierId:SearchSupplierId,
  query:string,
  fetchImpl:typeof fetch=fetch,
  maxResults=5
):Promise<{urls:string[];searchUrl?:string;error?:string}>{
  const cfg=configs[supplierId];
  let lastError="";
  if(supplierId==="dvd-dental"){
    try{
      const urls=await searchDvdKlevu(query,fetchImpl,maxResults);
      return urls.length?{urls,searchUrl:"klevu"}:{urls:[],error:"Sin resultados en DVD"};
    }catch(error){
      return {urls:[],error:error instanceof Error?error.message:"KLEVU_SEARCH_ERROR"};
    }
  }
  for(const template of cfg.templates){
    const searchUrl=template.replace("{q}",encodeURIComponent(query));
    try{
      const result=await trySearchRequest(searchUrl,query,cfg.origin,fetchImpl,maxResults);
      if(result.urls.length){
        if(supplierId==="ortolan"){
          const productPages=result.urls.filter(u=>/\.html(?:[?#]|$)/i.test(u));
          if(productPages.length)return {urls:productPages,searchUrl};
        }
        return {urls:result.urls,searchUrl};
      }
      lastError="Sin enlaces de producto";
    }catch(error){lastError=error instanceof Error?error.message:"SEARCH_ERROR";}
  }
  try{
    const detected=await searchViaDetectedForm(cfg,query,fetchImpl,maxResults);
    if(detected.urls.length)return detected;
  }catch(error){lastError=error instanceof Error?error.message:lastError;}
  try{
    const sitemapUrls=await searchViaSitemap(cfg,query,fetchImpl,maxResults);
    if(sitemapUrls.length)return {urls:sitemapUrls,searchUrl:"sitemap"};
  }catch(error){lastError=error instanceof Error?error.message:lastError;}
  return {urls:[],error:lastError||"Búsqueda no disponible"};
}
