import type { OpportunityInput, OpportunityScoreResult } from "./types";

function clamp(n:number,min=0,max=100){ return Math.min(max,Math.max(min,n)); }
function pctBelow(current:number,average:number):number{ return average>0 ? ((average-current)/average)*100 : 0; }
function pricePosition(current:number,min:number,max:number):number{
  if(max<=min) return 50;
  return clamp(((max-current)/(max-min))*100);
}
function closenessToMin(current:number,min:number,max:number):number{
  if(current<=0 || min<=0) return 0;
  if(max<=min) return current<=min?100:50;
  return clamp(100-((current-min)/(max-min))*100);
}

export function calculateOpportunityScore(input:OpportunityInput):OpportunityScoreResult{
  const {stats,currentPrice,isFresh,inStock,hasActivePromotion}=input;
  const reasons:string[]=[];
  const enoughObservations=stats.observationsTotal>=5;
  const enoughCoverage=stats.coverageDaysTotal>=30 && stats.coverageDays90>=20;
  const sufficientData=Boolean(
    currentPrice && currentPrice>0 && enoughObservations && enoughCoverage &&
    stats.average90d!==null && stats.min90d!==null && stats.max90d!==null
  );
  const confidence=clamp(
    Math.min(1,stats.observationsTotal/12)*50 +
    Math.min(1,stats.coverageDaysTotal/90)*50
  );

  if(!sufficientData){
    if(!enoughObservations) reasons.push("Se necesitan al menos 5 observaciones");
    if(!enoughCoverage) reasons.push("Se necesita al menos 30 días de cobertura histórica");
    return {
      score:null,label:"insuficiente",sufficientData:false,
      breakdown:{vsAverage30:null,vsAverage90:null,position90:null,distanceToHistoricalMin:null,promotionBonus:0,freshnessAdjustment:isFresh?0:-10,stockAdjustment:inStock?0:-20,confidence},
      reasons
    };
  }

  const current=currentPrice as number;
  const vs30=stats.average30d? pctBelow(current,stats.average30d):null;
  const vs90=stats.average90d? pctBelow(current,stats.average90d):null;
  const pos90=pricePosition(current,stats.min90d as number,stats.max90d as number);
  const nearMin=stats.historicalMin!==null && stats.historicalMax!==null ? closenessToMin(current,stats.historicalMin,stats.historicalMax):null;

  let score=50;
  if(vs30!==null) score += clamp(vs30,-25,25)*0.7;
  if(vs90!==null) score += clamp(vs90,-30,30)*0.9;
  score += (pos90-50)*0.35;
  if(nearMin!==null) score += (nearMin-50)*0.25;

  const promotionBonus=hasActivePromotion?4:0;
  const freshnessAdjustment=isFresh?0:-12;
  const stockAdjustment=inStock?0:-25;
  score += promotionBonus + freshnessAdjustment + stockAdjustment;
  score = 50 + (score-50)*(0.5 + 0.5*(confidence/100));
  score=clamp(Math.round(score));

  if(vs30!==null){
    if(vs30>=10) reasons.push("Precio "+Math.abs(vs30).toFixed(1)+"% por debajo de la media de 30 días");
    else if(vs30<=-10) reasons.push("Precio "+Math.abs(vs30).toFixed(1)+"% por encima de la media de 30 días");
  }
  if(vs90!==null){
    if(vs90>=10) reasons.push("Precio "+Math.abs(vs90).toFixed(1)+"% por debajo de la media de 90 días");
    else if(vs90<=-10) reasons.push("Precio "+Math.abs(vs90).toFixed(1)+"% por encima de la media de 90 días");
  }
  if(nearMin!==null && nearMin>=80) reasons.push("Muy cerca de su mínimo histórico");
  if(hasActivePromotion) reasons.push("Promoción activa");
  if(!isFresh) reasons.push("Datos no recientes");
  if(!inStock) reasons.push("Sin disponibilidad inmediata");

  const label = score<=20?"muy_caro":score<=40?"caro":score<=60?"normal":score<=80?"buen_precio":"precio_excepcional";
  return {score,label,sufficientData:true,breakdown:{vsAverage30:vs30,vsAverage90:vs90,position90:pos90,distanceToHistoricalMin:nearMin,promotionBonus,freshnessAdjustment,stockAdjustment,confidence},reasons};
}