import type { OpportunityScoreResult } from "../domain/opportunity";

export function ScoreBadge({score}:{score:OpportunityScoreResult}){
  if(!score.sufficientData || score.score===null) return <div className="score score-muted"><span>Histórico</span><strong>Insuficiente</strong><small>{score.reasons[0]??"Esperando más datos reales"}</small></div>;
  const label=score.label.replaceAll("_"," ");
  return <div className="score"><span>Opportunity Score</span><strong>{score.score}/100</strong><small>{label}</small></div>;
}