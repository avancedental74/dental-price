import type { SupplierOffer } from "../../types/domain";
import { offerStateSignature, promotionSignature } from "./signature";
import type { HistoryAppendResult, PriceObservation } from "./types";

function makeId(productId:string,offer:SupplierOffer,observedAt:string):string{
  const sku=offer.supplierSku ?? offer.manufacturerReference ?? "unknown";
  return [productId,offer.supplierId,sku,observedAt].join("::");
}

export function appendObservation(
  history: PriceObservation[],
  productId: string,
  offer: SupplierOffer,
  effectivePrice?: number
): HistoryAppendResult {
  const sorted=[...history].sort((a,b)=>new Date(a.observedAt).getTime()-new Date(b.observedAt).getTime());
  const last=[...sorted].reverse().find(item=>
    item.productId===productId &&
    item.supplierId===offer.supplierId &&
    (item.supplierSku ?? "")===(offer.supplierSku ?? "")
  );

  const observedAt=offer.observedAt;
  const currentSignature=offerStateSignature(offer,effectivePrice);
  if(last){
    const previousSignature=JSON.stringify({
      regularPrice:last.regularPrice,
      salePrice:last.salePrice ?? null,
      effectivePrice:last.effectivePrice ?? null,
      stockStatus:last.stockStatus,
      shippingCost:last.shippingCost ?? null,
      promotion:last.promotionSignature ?? null
    });
    if(previousSignature===currentSignature){
      const updated=sorted.map(item=>item.id===last.id ? {...item,lastSeenAt:observedAt,seenCount:item.seenCount+1} : item);
      return {history:updated,appended:false,compacted:true};
    }
  }

  const observation:PriceObservation={
    id:makeId(productId,offer,observedAt),
    productId,
    supplierId:offer.supplierId,
    supplierSku:offer.supplierSku,
    observedAt,
    lastSeenAt:observedAt,
    seenCount:1,
    regularPrice:offer.regularPrice,
    salePrice:offer.salePrice,
    effectivePrice,
    stockStatus:offer.stockStatus,
    shippingCost:offer.shippingCost,
    promotionSignature:promotionSignature(offer),
    sourceUrl:offer.productUrl
  };
  return {history:[...sorted,observation],appended:true,compacted:false};
}