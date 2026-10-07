import type { SupplierOffer } from "../../types/domain";
import { compareSupplierOffers } from "../comparison";
import { calculatePricing } from "../pricing";
import type { BasketAssignment, BasketOptimizationResult, BasketRequestItem, BasketSupplierSummary } from "./types";

function money(n:number){return Math.round(n*100)/100;}
function cents(n:number){return Math.round(n*100);}
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

function summarize(assignments:BasketAssignment[]):{total:number;suppliers:BasketSupplierSummary[]}|null{
  const groups=new Map<string,BasketAssignment[]>();
  for(const a of assignments){const list=groups.get(a.supplierId)??[];list.push(a);groups.set(a.supplierId,list);}
  const suppliers:BasketSupplierSummary[]=[];
  let total=0;
  for(const [supplierId,lines] of groups){
    const merchandiseGross=money(lines.reduce((n,x)=>n+x.lineGross,0));
    const netValues=lines.map(x=>x.lineNet);
    const merchandiseNet=netValues.some(x=>x==null)
      ? null
      : money(netValues.reduce<number>((sum,value)=>sum+(value as number),0));
    const shipping=supplierShipping(lines,merchandiseNet,merchandiseGross);
    if(!Number.isFinite(shipping)) return null;
    const supplierTotal=money(merchandiseGross+shipping);
    suppliers.push({supplierId,merchandiseGross,merchandiseNet,shipping,total:supplierTotal,lines:lines.length});
    total+=supplierTotal;
  }
  return {total:money(total),suppliers};
}

export function optimizeBasket(items:BasketRequestItem[],maxStates=250000):BasketOptimizationResult{
  const missingProductIds:string[]=[];
  const choices=items.map(item=>{
    const cmp=compareSupplierOffers(item.product,item.offers,item.quantity);
    if(!cmp.ranked.length) missingProductIds.push(item.product.id);
    return cmp.ranked.map(x=>{
      const costs=lineCosts(x.offer,item.quantity);
      return {
        item,
        assignment:{productId:item.product.id,quantity:item.quantity,supplierId:x.offer.supplierId,offer:x.offer,lineGross:costs.gross,lineNet:costs.net} satisfies BasketAssignment
      };
    }).sort((a,b)=>a.assignment.lineGross-b.assignment.lineGross);
  });
  if(missingProductIds.length) return {total:null,assignments:[],suppliers:[],missingProductIds,combinationsEvaluated:0};

  // Harder lines first improves pruning because scarce supplier choices become fixed earlier.
  choices.sort((a,b)=>a.length-b.length);
  const suffixLowerBound=new Array(choices.length+1).fill(0);
  for(let i=choices.length-1;i>=0;i--){
    suffixLowerBound[i]=suffixLowerBound[i+1]+Math.min(...choices[i].map(x=>x.assignment.lineGross));
  }

  let best:{total:number;assignments:BasketAssignment[];suppliers:BasketSupplierSummary[]}|null=null;
  let states=0;
  const memo=new Map<string,number>();

  function stateKey(index:number,assignments:BasketAssignment[]):string{
    const groups=new Map<string,{gross:number;net:number|null;count:number}>();
    for(const a of assignments){
      const g=groups.get(a.supplierId)??{gross:0,net:0,count:0};
      g.gross+=a.lineGross;
      g.net=g.net==null||a.lineNet==null?null:g.net+a.lineNet;
      g.count++;
      groups.set(a.supplierId,g);
    }
    return index+"|"+[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([id,g])=>[
      id,cents(g.gross),g.net==null?"n":cents(g.net),g.count
    ].join(":")).join(",");
  }

  function recurse(index:number,assignments:BasketAssignment[],merchandiseGross:number){
    states++;
    if(states>maxStates) return;

    // Shipping is non-negative, so merchandise gross alone is a safe optimistic lower bound.
    const optimistic=merchandiseGross+suffixLowerBound[index];
    if(best&&optimistic>=best.total) return;

    const key=stateKey(index,assignments);
    const previous=memo.get(key);
    if(previous!==undefined&&previous<=merchandiseGross) return;
    memo.set(key,merchandiseGross);

    if(index===choices.length){
      const summary=summarize(assignments);
      if(summary&&(!best||summary.total<best.total)) best={...summary,assignments:[...assignments]};
      return;
    }

    for(const choice of choices[index]){
      assignments.push(choice.assignment);
      recurse(index+1,assignments,merchandiseGross+choice.assignment.lineGross);
      assignments.pop();
      if(states>maxStates) break;
    }
  }

  recurse(0,[],0);

  if(!best){
    const tooComplex=states>maxStates;
    if(tooComplex) throw new Error("La cesta es demasiado compleja para optimizar con seguridad; reduce temporalmente el número de líneas o proveedores.");
    return {total:null,assignments:[],suppliers:[],missingProductIds:items.map(x=>x.product.id),combinationsEvaluated:states};
  }
  return {...best,missingProductIds:[],combinationsEvaluated:states};
}