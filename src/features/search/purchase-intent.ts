import {normalizeName} from "../../domain/matching/normalization";

export type PurchaseIntentMatch="requested_product"|"related_accessory";

// General product-role detection, not a rule for alginates or any one category.
// Never exclude products silently; related accessories remain inspectable.
const accessoryHeads=new Set([
  "taza","bol","bowl","espatula","dispensador","dispensadora",
  "aplicador","aplicadora","mezclador","mezcladora","soporte",
  "organizador","organizadora","porta","cubeta","bandeja","recipiente"
]);

function tokens(value:string):string[]{
  return normalizeName(value).split(/[^a-z0-9]+/).filter(Boolean);
}

export function classifyPurchaseIntent(query:string,name:string):PurchaseIntentMatch{
  const requested=new Set(tokens(query));
  const title=tokens(name);
  if(!title.length||!requested.size)return "requested_product";
  // If the accessory itself was requested, show it as the main product.
  if([...requested].some(word=>accessoryHeads.has(word)))return "requested_product";
  // Exclude an accessory based on its primary product noun, not because the
  // item simply mentions the search term in compatible/use-with copy.
  return accessoryHeads.has(title[0]!)?"related_accessory":"requested_product";
}
