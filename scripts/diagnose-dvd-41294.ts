import { parseDvdProductHtml } from "../src/connectors/dvd-dental/parser";
import { normalizeDvd } from "../src/connectors/dvd-dental/normalizer";
import { matchOfferToProduct } from "../src/domain/matching/matcher";
import products from "../data/products.json" with { type: "json" };

const url="https://www.dvd-dental.com/adhesivo-scotchbond-universal-plus-5ml/";
const response=await fetch(url,{headers:{"user-agent":"DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)",accept:"text/html,application/xhtml+xml"}});
const html=await response.text();
const flat=html.replace(/\s+/g," ");
const needles=["REF. FAB","41294","REF. DVD","3138780","IVA incl","excl. Tax","en stock","OFERTA","Promo"];
console.log(JSON.stringify({status:response.status,finalUrl:response.url,length:html.length,contains:Object.fromEntries(needles.map(n=>[n,flat.toLowerCase().includes(n.toLowerCase())]))},null,2));
for(const needle of needles){
  const i=flat.toLowerCase().indexOf(needle.toLowerCase());
  if(i>=0) console.log("\n--- "+needle+" ---\n"+flat.slice(Math.max(0,i-450),i+1100));
}
const raw=parseDvdProductHtml(html,url);
const offers=normalizeDvd(raw);
const product=(products as any[]).find(p=>p.manufacturerReference==="41294");
console.log("\nRAW\n"+JSON.stringify(raw,null,2));
console.log("\nOFFERS\n"+JSON.stringify(offers,null,2));
console.log("\nMATCH\n"+JSON.stringify(offers.map(o=>matchOfferToProduct(product,o)),null,2));
