import * as cheerio from "cheerio";
import { normalizeName, normalizeReference } from "../domain/matching/normalization";

export type SearchSupplierId="dentaltix"|"dentalcost"|"dvd-dental"|"proclinic"|"dental-iberica"|"dentalexpress"|"brokerdental"|"ortolan";

const configs:Record<SearchSupplierId,{origin:string;templates:string[]}>={
  dentaltix:{origin:"https://www.dentaltix.com",templates:[
    "https://www.dentaltix.com/es/search?q={q}",
    "https://www.dentaltix.com/es/search?text={q}",
    "https://www.dentaltix.com/es/search?search_query={q}"
  ]},
  dentalcost:{origin:"https://dentalcost.es",templates:[
    "https://dentalcost.es/search?controller=search&s={q}",
    "https://dentalcost.es/buscar?controller=search&s={q}",
    "https://dentalcost.es/catalogsearch/result/?q={q}"
  ]},
  "dvd-dental":{origin:"https://dvd-dental.com",templates:[
    "https://dvd-dental.com/search?controller=search&s={q}",
    "https://dvd-dental.com/buscar?controller=search&s={q}",
    "https://dvd-dental.com/catalogsearch/result/?q={q}"
  ]},
  proclinic:{origin:"https://www.proclinic.es",templates:[
    "https://www.proclinic.es/tienda/catalogsearch/result/?q={q}",
    "https://www.proclinic.es/tienda/search?q={q}",
    "https://www.proclinic.es/tienda/buscar?q={q}"
  ]},
  "dental-iberica":{origin:"https://dentaliberica.com",templates:[
    "https://dentaliberica.com/?s={q}&post_type=product",
    "https://dentaliberica.com/search?controller=search&s={q}"
  ]},
  dentalexpress:{origin:"https://dentalexpress.es",templates:[
    "https://dentalexpress.es/catalogsearch/result/?q={q}",
    "https://dentalexpress.es/search?controller=search&s={q}"
  ]},
  brokerdental:{origin:"https://www.brokerdental.es",templates:[
    "https://www.brokerdental.es/catalogsearch/result/?q={q}",
    "https://www.brokerdental.es/search?controller=search&s={q}"
  ]},
  ortolan:{origin:"https://ortolan.es",templates:[
    "https://ortolan.es/es/buscar?controller=search&s={q}",
    "https://ortolan.es/es/search?controller=search&s={q}"
  ]}
};

const deniedParts=["/login","/registro","/cart","/carrito","/checkout","/contact","/contacto","/blog","/category","/categoria","/marca","/brand","javascript:","#"];

function scoreLink(text:string,href:string,query:string):number{
  const q=normalizeName(query),hay=normalizeName(text+" "+href);
  const compact=normalizeReference(query);
  let score=0;
  if(compact&&normalizeReference(hay).includes(compact))score+=12;
  const tokens=q.split(" ").filter(t=>t.length>=2);
  for(const token of tokens)if(hay.includes(token))score+=token.length>=5?3:1;
  if(/product|producto|html|\/es\//i.test(href))score+=1;
  return score;
}

export async function discoverSupplierProductUrls(
  supplierId:SearchSupplierId,
  query:string,
  fetchImpl:typeof fetch=fetch,
  maxResults=5
):Promise<{urls:string[];searchUrl?:string;error?:string}>{
  const cfg=configs[supplierId];
  const headers={"user-agent":"DentalPrice/0.3 (+https://github.com/avancedental74/dental-price; live federated search)",accept:"text/html,application/xhtml+xml"};
  let lastError="";
  for(const template of cfg.templates){
    const searchUrl=template.replace("{q}",encodeURIComponent(query));
    try{
      const response=await fetchImpl(searchUrl,{headers,redirect:"follow"});
      if(!response.ok){lastError="HTTP "+response.status;continue;}
      const html=await response.text(),$=cheerio.load(html);
      const found=new Map<string,{url:string;score:number}>();
      $("a[href]").each((_,el)=>{
        const raw=$(el).attr("href")??"";
        const text=$(el).text().replace(/\s+/g," ").trim();
        if(!raw||deniedParts.some(x=>raw.toLowerCase().includes(x)))return;
        let url:string;
        try{url=new URL(raw,response.url||cfg.origin).toString();}catch{return;}
        if(new URL(url).origin!==new URL(cfg.origin).origin)return;
        if(url===searchUrl||url.endsWith("/")||text.length<2)return;
        const score=scoreLink(text,url,query);
        if(score<2)return;
        const old=found.get(url);
        if(!old||score>old.score)found.set(url,{url,score});
      });
      const urls=[...found.values()].sort((a,b)=>b.score-a.score).slice(0,maxResults).map(x=>x.url);
      if(urls.length)return {urls,searchUrl};
      lastError="Sin enlaces de producto";
    }catch(error){lastError=error instanceof Error?error.message:"SEARCH_ERROR";}
  }
  return {urls:[],error:lastError||"Búsqueda no disponible"};
}
