const url="https://www.dvd-dental.com/composite-filtek-supreme-xte-jeringas-3g/";
const response=await fetch(url,{headers:{"user-agent":"DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)",accept:"text/html,application/xhtml+xml"}});
const html=await response.text();
const flat=html.replace(/\s+/g," ");
const needles=["4910A3B","4910A1B","7120","Ref. fabr.","Ref. DVD","45,80","50,38","A3B","A3 Body","Tabla de productos"];
console.log(JSON.stringify({status:response.status,length:html.length,finalUrl:response.url,contains:Object.fromEntries(needles.map(n=>[n,flat.includes(n)]))},null,2));
for(const needle of ["4910A3B","7120","A3B","45,80"]){
 const i=flat.indexOf(needle); if(i>=0) console.log("\nSNIPPET "+needle+"\n"+flat.slice(Math.max(0,i-800),i+1800));
}