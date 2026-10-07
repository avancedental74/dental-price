import * as cheerio from "cheerio";
import { normalizeName, normalizeReference } from "../domain/matching/normalization";

export type SearchSupplierId="dentaltix"|"dentalcost"|"dvd-dental"|"proclinic"|"dental-iberica"|"dentalexpress"|"brokerdental"|"ortolan";

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
  ]}
};

const deniedParts=["/login","/registro","/cart","/carrito","/checkout","/contact","/contacto","/blog","/category","/categoria","/marca","/brand","javascript:","#"];
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
  const q=normalizeName(query),hay=normalizeName(text+" "+href);
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
  const productSelectors=[
    '[data-testid="product-card"] a[href]',
    '.product-item a[href]',
    '.product-items a[href]',
    '.product-miniature a[href]',
    'article[data-id-product] a[href]',
    '.product-container a[href]',
    '.product-title a[href]',
    'a.product-item-link[href]'
  ].join(",");
  const productUrls=new Set<string>();
  $(productSelectors).each((_,el)=>{
    const raw=$(el).attr("href")??"";
    try{
      const url=new URL(raw,base).toString();
      if(new URL(url).origin===new URL(origin).origin&&!deniedParts.some(x=>url.toLowerCase().includes(x))&&!isSearchOrNavigationUrl(url,base))productUrls.add(url);
    }catch{ /* ignore invalid result link */ }
  });
  $("a[href]").each((_,el)=>{
    const raw=$(el).attr("href")??"";
    const text=$(el).text().replace(/\s+/g," ").trim();
    if(!raw||deniedParts.some(x=>raw.toLowerCase().includes(x)))return;
    let url:string;
    try{url=new URL(raw,base).toString();}catch{return;}
    if(new URL(url).origin!==new URL(origin).origin)return;
    if(url===base||url.endsWith("/")||isSearchOrNavigationUrl(url,base))return;
    const isProductResult=productUrls.has(url);
    const score=scoreLink(text,url,query)+(isProductResult?8:0);
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
  for(const template of cfg.templates){
    const searchUrl=template.replace("{q}",encodeURIComponent(query));
    try{
      const result=await trySearchRequest(searchUrl,query,cfg.origin,fetchImpl,maxResults);
      if(result.urls.length)return {urls:result.urls,searchUrl};
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
