const base="https://www.dvd-dental.com";
const url=base+"/composite-filtek-supreme-xte-jeringas-3g/";
const ua="DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)";
const page=await fetch(url,{headers:{"user-agent":ua,accept:"text/html,application/xhtml+xml"}});
const html=await page.text();
const cookie=(page.headers.get("set-cookie")??"").split(",").map(x=>x.split(";")[0]).join("; ");
const productId=html.match(/name=["']product_id["'][^>]*value=["'](\d+)["']/i)?.[1] ?? html.match(/product_id:\s*["']?(\d+)/i)?.[1] ?? "795";
const attr=html.match(/name=["']attribute\[(\d+)\]["'][^>]*value=["']1529["']/i)?.[1] ?? "491";
const endpoint=base+`/remote/v1/product-attributes/${productId}`;
const params=new URLSearchParams({action:"add",product_id:productId,"qty[]":"1",[`attribute[${attr}]`]:"1529"});

async function inspect(label:string,r:Response){
 const json=await r.json().catch(()=>null);
 const d=json?.data;
 console.log(JSON.stringify({label,status:r.status,base:d?.base,sku:d?.sku,instock:d?.instock,net:d?.price?.sale_price_without_tax?.value??d?.price?.without_tax?.value,gross:d?.price?.sale_price_with_tax?.value??d?.price?.with_tax?.value},null,2));
}
const common={"user-agent":ua,accept:"application/json","x-requested-with":"XMLHttpRequest",...(cookie?{cookie}:{})};
await inspect("POST_XHR_COOKIE",await fetch(endpoint,{method:"POST",headers:{...common,"content-type":"application/x-www-form-urlencoded; charset=UTF-8"},body:params.toString()}));
await inspect("GET_QUERY_XHR_COOKIE",await fetch(endpoint+"?"+params.toString(),{headers:common}));
console.log(JSON.stringify({pageStatus:page.status,hasCookie:Boolean(cookie),productId,attributeId:attr},null,2));