import type { SupplierOffer } from "../../types/domain";
import { compareSupplierOffers } from "../comparison";
import { calculatePricing } from "../pricing";
import type { BasketAssignment, BasketOptimizationResult, BasketRequestItem, BasketSupplierSummary } from "./types";

function money(n:number){return Math.round(n*100)/100;}
function withoutShipping(offer:SupplierOffer):SupplierOffer{return {...offer,shippingCost:0,freeShippingThreshold:undefined,shippingCostVatIncluded:true};}
function lineCosts(offer:SupplierOffer,quantity:number){
  const p=calculatePricing(withoutShipping(offer),{requestedQuantity:quantity,includeVat:true});
  const gross=p.effectiveTotalCost;
  const net=offer.vatStatus==="excluded" ? p.promotionalSubtotal
    : offer.vatStatus==="included"&&typeof offer.vatRate==="number" ? gross/(1+offer.vatRate/100)
    : null;
  return {gross:money(gross),net:net==null?null:money(net)};
}
function supplierShipping(lines:BasketAssignment[],net:number|null,gross:number):number{
  const offer=lines[0].offer;
  const policyKeys=new Set(lines.map(line=>JSON.stringify([
    line.offer.shippingCost,line.offer.shippingCostVatIncluded,line.offer.shippingVatRate,
    line.offer.freeShippingThreshold,line.offer.freeShippingThresholdBasis
  ])));
  if(policyKeys.size>1) return Infinity;
  if(lines.every(line=>line.offer.promotion?.type==="free_shipping")) return 0;
  if(typeof offer.freeShippingThreshold==="number"){
    const basisType=offer.freeShippingThresholdBasis??"net";
    if(basisType==="net"&&net==null) return Infinity;
    const basis=basisType==="net" ? net! : gross;
    if(basis>=offer.freeShippingThreshold) return 0;
  }
  if(typeof offer.shippingCost!=="number") return Infinity;
  if(offer.shippingCostVatIncluded!==false) return offer.shippingCost;
  if(typeof offer.shippingVatRate!=="number") return Infinity;
  return money(offer.shippingCost*(1+offer.shippingVatRate/100));
}
function cartesian<T>(sets:T[][]):T[][]{
  return sets.reduce<T[][]>((acc,set)=>acc.flatMap(prefix=>set.map(item=>[...prefix,item])),[[]]);
}

export function optimizeBasket(items:BasketRequestItem[],maxCombinations=100000):BasketOptimizationResult{
  const missingProductIds:string[]=[];
  const choices=items.map(item=>{
    const cmp=compareSupplierOffers(item.product,item.offers,item.quantity);
    if(!cmp.ranked.length) missingProductIds.push(item.product.id);
    return cmp.ranked.map(x=>({item,offer:x.offer}));
  });
  if(missingProductIds.length) return {total:null,assignments:[],suppliers:[],missingProductIds,combinationsEvaluated:0};
  const estimated=choices.reduce((n,set)=>n*set.length,1);
  if(estimated>maxCombinations) throw new Error("Basket has too many supplier combinations");
  let best:{total:number;assignments:BasketAssignment[];suppliers:BasketSupplierSummary[]}|null=null;
  let combinationsEvaluated=0;
  for(const combination of cartesian(choices)){
    combinationsEvaluated++;
    const assignments:BasketAssignment[]=combination.map(({item,offer})=>{
      const costs=lineCosts(offer,item.quantity);
      return {productId:item.product.id,quantity:item.quantity,supplierId:offer.supplierId,offer,lineGross:costs.gross,lineNet:costs.net};
    });
    const groups=new Map<string,BasketAssignment[]>();
    for(const a of assignments){const list=groups.get(a.supplierId)??[];list.push(a);groups.set(a.supplierId,list);}
    const suppliers:BasketSupplierSummary[]=[];
    let total=0,invalid=false;
    for(const [supplierId,lines] of groups){
      const merchandiseGross=money(lines.reduce((n,x)=>n+x.lineGross,0));
      const netValues=lines.map(x=>x.lineNet);
      const merchandiseNet=netValues.some(x=>x==null)?null:money(netValues.reduce((n,x)=>n+(x??0),0));
      const shipping=supplierShipping(lines,merchandiseNet,merchandiseGross);
      if(!Number.isFinite(shipping)){invalid=true;break;}
      const supplierTotal=money(merchandiseGross+shipping);
      suppliers.push({supplierId,merchandiseGross,merchandiseNet,shipping,total:supplierTotal,lines:lines.length});
      total+=supplierTotal;
    }
    if(invalid) continue;
    total=money(total);
    if(!best||total<best.total) best={total,assignments,suppliers};
  }
  return best?{...best,missingProductIds:[],combinationsEvaluated}:{total:null,assignments:[],suppliers:[],missingProductIds:items.map(x=>x.product.id),combinationsEvaluated};
}