export {};
const base="https://www.dvd-dental.com";
const pageUrl=base+"/composite-filtek-supreme-xte-jeringas-3g/";
const ua="DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)";
const page=await fetch(pageUrl,{headers:{"user-agent":ua,accept:"text/html,application/xhtml+xml"}});
const html=await page.text();
const cookie=page.headers.get("set-cookie")??"";
const csrf=html.match(/csrf_token["']?\s*:\s*["']([^"']+)/i)?.[1]??"";
const productId=html.match(/product_id:\s*["']?(\d+)/i)?.[1]??"795";
const attributeId=html.match(/name=["']attribute\[(\d+)\]["'][^>]*value=["']1529["']/i)?.[1]??"491";
const params=new URLSearchParams({action:"add",product_id:productId,"qty[]":"1",[`attribute[${attributeId}]`]:"1529"});
const r=await fetch(base+`/remote/v1/product-attributes/${productId}`,{
 method:"POST",
 headers:{
   "user-agent":ua,accept:"application/json",
   "content-type":"application/x-www-form-urlencoded; charset=UTF-8",
   "x-requested-with":"stencil-utils","stencil-config":"{}","stencil-options":"{}",
   "x-xsrf-token":csrf,
   ...(cookie?{cookie}: {})
 },
 body:params.toString()
});
const json=await r.json();
console.log(JSON.stringify({pageStatus:page.status,hasCookie:Boolean(cookie),hasCsrf:Boolean(csrf),productId,attributeId,variantStatus:r.status,data:json?.data??json},null,2));