const base="https://www.dvd-dental.com";
const productId="795", attributeId="491", optionId="1529";
const ua="DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)";
const endpoints=[
  base+`/remote/v1/product-attributes/${productId}?attribute[${attributeId}]=${optionId}`,
  base+`/remote/v1/product-attributes/${productId}?attribute%5B${attributeId}%5D=${optionId}`,
  base+`/remote/v1/product-attributes/${productId}?action=add&product_id=${productId}&qty%5B%5D=1&attribute%5B${attributeId}%5D=${optionId}`
];
for(const endpoint of endpoints){
 const r=await fetch(endpoint,{headers:{"user-agent":ua,accept:"application/json"}});
 const body=await r.text();
 console.log(JSON.stringify({endpoint,status:r.status,body:body.slice(0,4000)},null,2));
}