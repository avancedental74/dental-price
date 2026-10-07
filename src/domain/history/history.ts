import type { SupplierOffer } from "../../types/domain";
import { offerStateSignature, promotionSignature } from "./signature";
import type { HistoryAppendResult, PriceObservation } from "./types";

function makeId(productId:string,offer:SupplierOffer,observedAt:string,requestedQuantity:number):string{
  const sku=offer.supplierSku ?? offer.manufacturerReference ?? "unknown";
  return [productId,offer.supplierId,sku,requestedQuantity,observedAt].join("::");
}

export function appendObservation(
  history: PriceObservation[],
  productId: string,
  offer: SupplierOffer,
  effectiveUnitCost?: number,
  effectiveTotalCost?: number,
  requestedQuantity=1
): HistoryAppendResult {
  const sorted=[...history].sort((a,b)=>new Date(a.observedAt).getTime()-new Date(b.observedAt).getTime());
  const last=[...sorted].reverse().find(item=>
    item.productId===productId &&
    item.supplierId===offer.supplierId &&
    (item.supplierSku ?? "")===(offer.supplierSku ?? "") &&
    item.requestedQuantity===requestedQuantity
  );
  const observedAt=offer.observedAt;
  const currentSignature=offerStateSignature(offer,effectiveUnitCost,requestedQuantity);
  if(last){
    const previousSignature=JSON.stringify({
      requestedQuantity:last.requestedQuantity,
      regularPrice:last.regularPrice,
      salePrice:last.salePrice ?? null,
      effectiveUnitCost:last.effectiveUnitCost ?? null,
      stockStatus:last.stockStatus,
      shippingCost:last.shippingCost ?? null,
      promotion:last.promotionSignature ?? null,
      presentation:last.presentation ?? null,
      quantity:last.quantity ?? null,
      unit:last.unit ?? null,
      packCount:last.packCount ?? null
    });
    if(previousSignature===currentSignature){
      const updated=sorted.map(item=>item.id===last.id ? {...item,lastSeenAt:observedAt,seenCount:item.seenCount+1} : item);
      return {history:updated,appended:false,compacted:true};
    }
  }
  const observation:PriceObservation={
    id:makeId(productId,offer,observedAt,requestedQuantity),
    productId,supplierId:offer.supplierId,supplierSku:offer.supplierSku,observedAt,lastSeenAt:observedAt,seenCount:1,
    requestedQuantity,regularPrice:offer.regularPrice,salePrice:offer.salePrice,effectiveUnitCost,effectiveTotalCost,
    stockStatus:offer.stockStatus,shippingCost:offer.shippingCost,promotionSignature:promotionSignature(offer),
    presentation:offer.presentation,quantity:offer.quantity,unit:offer.unit,packCount:offer.packCount,sourceUrl:offer.productUrl
  };
  return {history:[...sorted,observation],appended:true,compacted:false};
}