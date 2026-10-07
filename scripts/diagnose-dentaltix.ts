const url="https://www.dentaltix.com/es/3m/filtek-supreme-xte-kit-composite-profesional-12-jer?sku=053M4910A3B";
const response=await fetch(url,{headers:{"user-agent":"DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)",accept:"text/html,application/xhtml+xml"}});
const html=await response.text();
const normalized=html.replace(/\s+/g," ");
const needles=["4910A3B","053M4910A3B","44.90","44,90","36.90","36,90","Variants & quick order","Ref. fabricante","Manuf. ref.","Precio recomendado","Recommended price"];
console.log(JSON.stringify({status:response.status,length:html.length,finalUrl:response.url,contains:Object.fromEntries(needles.map(n=>[n,normalized.includes(n)]))},null,2));
for(const needle of ["4910A3B","053M4910A3B"]){
  const i=normalized.indexOf(needle);
  if(i>=0) console.log("\nSNIPPET "+needle+"\n"+normalized.slice(Math.max(0,i-500),i+1000));
}