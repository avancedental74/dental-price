const base="https://www.dvd-dental.com";
const productId="795", attributeId="491", optionId="1529";
const ua="DentalPrice/0.1 (+https://github.com/avancedental74/dental-price; single-user price research)";
const params=new URLSearchParams({action:"add",product_id:productId,"qty[]":"1",[`attribute[${attributeId}]`]:optionId});
const r=await fetch(base+`/remote/v1/product-attributes/${productId}`,{
  method:"POST",
  headers:{
    "user-agent":ua,
    accept:"application/json",
    "content-type":"application/x-www-form-urlencoded; charset=UTF-8",
    "x-requested-with":"stencil-utils",
    "stencil-config":"{}",
    "stencil-options":"{}",
    "x-xsrf-token":""
  },
  body:params.toString()
});
const body=await r.text();
console.log(JSON.stringify({status:r.status,contentType:r.headers.get("content-type"),body:body.slice(0,6000)},null,2));