import type { PriceHistoryStats, PriceObservation } from "./types";

function priceOf(obs:PriceObservation):number|null{
  const value=obs.effectivePrice ?? obs.salePrice ?? obs.regularPrice;
  return Number.isFinite(value) && value>0 ? value : null;
}

function avg(values:number[]):number|null{
  if(!values.length) return null;
  return Math.round((values.reduce((a,b)=>a+b,0)/values.length)*100)/100;
}

function min(values:number[]):number|null{ return values.length?Math.min(...values):null; }
function max(values:number[]):number|null{ return values.length?Math.max(...values):null; }

export function calculateHistoryStats(history:PriceObservation[],now=new Date()):PriceHistoryStats{
  const valid=history
    .map(obs=>({obs,price:priceOf(obs)}))
    .filter((x):x is {obs:PriceObservation;price:number}=>x.price!==null)
    .sort((a,b)=>new Date(a.obs.observedAt).getTime()-new Date(b.obs.observedAt).getTime());

  const cutoff30=now.getTime()-30*24*60*60*1000;
  const cutoff90=now.getTime()-90*24*60*60*1000;
  const p30=valid.filter(x=>new Date(x.obs.lastSeenAt).getTime()>=cutoff30).map(x=>x.price);
  const p90=valid.filter(x=>new Date(x.obs.lastSeenAt).getTime()>=cutoff90).map(x=>x.price);
  const all=valid.map(x=>x.price);

  return {
    currentPrice: valid.length ? valid[valid.length-1].price : null,
    average30d: avg(p30),
    average90d: avg(p90),
    min90d: min(p90),
    max90d: max(p90),
    historicalMin: min(all),
    historicalMax: max(all),
    observations30d:p30.length,
    observations90d:p90.length,
    observationsTotal:all.length
  };
}