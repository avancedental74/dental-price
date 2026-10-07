import type { PriceHistoryStats, PriceObservation } from "./types";

function priceOf(obs:PriceObservation):number|null{
  const value=obs.effectiveUnitCost;
  return typeof value==="number" && Number.isFinite(value) && value>0 ? value : null;
}
function round(n:number){return Math.round(n*100)/100;}
function days(ms:number){return ms/(24*60*60*1000);}

function weightedAverage(items:{price:number;start:number;end:number}[],from:number,to:number):{avg:number|null;coverage:number}{
  let valueTime=0,totalTime=0;
  for(const item of items){
    const start=Math.max(item.start,from), end=Math.min(item.end,to);
    if(end<=start) continue;
    const duration=end-start;
    valueTime+=item.price*duration;
    totalTime+=duration;
  }
  return {avg:totalTime?round(valueTime/totalTime):null,coverage:round(days(totalTime))};
}

export function calculateHistoryStats(history:PriceObservation[],now=new Date()):PriceHistoryStats{
  const valid=history.map(obs=>({obs,price:priceOf(obs)}))
    .filter((x):x is {obs:PriceObservation;price:number}=>x.price!==null)
    .sort((a,b)=>new Date(a.obs.observedAt).getTime()-new Date(b.obs.observedAt).getTime());

  if(!valid.length) return {currentPrice:null,average30d:null,average90d:null,min90d:null,max90d:null,historicalMin:null,historicalMax:null,observations30d:0,observations90d:0,observationsTotal:0,coverageDays30:0,coverageDays90:0,coverageDaysTotal:0};

  const intervals=valid.map((x,i)=>{
    const start=new Date(x.obs.observedAt).getTime();
    const next=i<valid.length-1?new Date(valid[i+1].obs.observedAt).getTime():new Date(x.obs.lastSeenAt).getTime();
    return {price:x.price,start,end:Math.max(start,next)};
  });
  const nowMs=now.getTime(), cutoff30=nowMs-30*86400000, cutoff90=nowMs-90*86400000;
  const w30=weightedAverage(intervals,cutoff30,nowMs), w90=weightedAverage(intervals,cutoff90,nowMs);
  const within30=valid.filter(x=>new Date(x.obs.lastSeenAt).getTime()>=cutoff30);
  const within90=valid.filter(x=>new Date(x.obs.lastSeenAt).getTime()>=cutoff90);
  const current=[...valid].sort((a,b)=>new Date(b.obs.lastSeenAt).getTime()-new Date(a.obs.lastSeenAt).getTime())[0];
  const all=valid.map(x=>x.price), p90=within90.map(x=>x.price);
  const first=Math.min(...valid.map(x=>new Date(x.obs.observedAt).getTime()));
  const last=Math.max(...valid.map(x=>new Date(x.obs.lastSeenAt).getTime()));

  return {
    currentPrice:current.price,average30d:w30.avg,average90d:w90.avg,
    min90d:p90.length?Math.min(...p90):null,max90d:p90.length?Math.max(...p90):null,
    historicalMin:Math.min(...all),historicalMax:Math.max(...all),
    observations30d:within30.length,observations90d:within90.length,observationsTotal:valid.length,
    coverageDays30:w30.coverage,coverageDays90:w90.coverage,coverageDaysTotal:round(days(Math.max(0,last-first)))
  };
}