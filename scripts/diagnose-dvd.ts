const url="https://www.dvd-dental.com/composite-filtek-supreme-xte-jeringas-3g/";
const response=await fetch(url,{headers:{"user-agent":"DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)",accept:"text/html,application/xhtml+xml"}});
const html=await response.text();
const flat=html.replace(/\s+/g," ");
const needles=["1529","attribute[491]","productAttributes","product-options","optionChange","getById","productId","entityId","sku","price","4910A3B"];
console.log(JSON.stringify({status:response.status,length:html.length,finalUrl:response.url,contains:Object.fromEntries(needles.map(n=>[n,flat.includes(n)]))},null,2));
for(const needle of ["1529","productAttributes","optionChange","entityId","sku"]){
 const indexes=[]; let pos=0; while((pos=flat.indexOf(needle,pos))>=0&&indexes.length<4){indexes.push(pos);pos+=needle.length;}
 for(const [j,i] of indexes.entries()) console.log("\nSNIPPET "+needle+" #"+j+"\n"+flat.slice(Math.max(0,i-1200),i+2600));
}