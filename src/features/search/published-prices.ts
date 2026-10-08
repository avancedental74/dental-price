import type {UniversalOffer,UniversalProduct,SearchFilters,SearchFacet} from "./universal";

const keys:SearchFacet[]=["manufacturer","presentation","shade","variant","material","size","powder","sterile","color","quantity"];

export interface PublishedPriceRow {
  id:string;
  productId:string;
  productName:string;
  offer:UniversalOffer;
}

/**
 * Product discovery and price visibility are separate from ranking eligibility.
 * A supplier's unconfirmed price is evidence of an advertised amount, not a
 * comparable checkout quotation; it must remain visible with its warning.
 */
export function collectPublishedPrices(products:UniversalProduct[],filters:SearchFilters={}):PublishedPriceRow[]{
  const rows=products.flatMap(product=>product.offers
    .filter(offer=>keys.every(key=>!filters[key]||offer.properties[key]===filters[key]))
    .map(offer=>({
      id:offer.id,productId:product.group.id,
      productName:product.group.label,offer
    })));
  return rows.sort((a,b)=>
    a.productName.localeCompare(b.productName,"es",{sensitivity:"base"})||
    a.offer.supplierId.localeCompare(b.offer.supplierId,"es")||
    (a.offer.publishedPrice-b.offer.publishedPrice));
}

export function advertisedPriceLabel(offer:UniversalOffer):string{
  if(offer.verificationLevel==="A")return "Nivel A - precio de compra contrastado";
  if(offer.verificationLevel==="B")return "Nivel B - precio de ficha";
  return "Nivel C - precio orientativo";
}

export function hasAdvertisedPrice(offer:UniversalOffer):boolean{
  return Number.isFinite(offer.publishedPrice)&&offer.publishedPrice>0;
}
