import type { PriceObservation } from "../domain/history";
import type { PriceHistoryStats } from "../domain/history";

export function HistoryPanel({history,stats}:{history:PriceObservation[];stats:PriceHistoryStats}){
  const values=history.map(h=>h.effectivePrice ?? h.salePrice ?? h.regularPrice);
  const min=Math.min(...values),max=Math.max(...values),span=max-min || 1;
  const points=values.map((v,i)=>`${(i/(Math.max(1,values.length-1)))*100},${90-((v-min)/span)*70}`).join(" ");
  return <section className="card history-card">
    <div className="section-head"><div><p className="eyebrow">HISTÓRICO</p><h3>Evolución de precio</h3></div><span>{stats.observationsTotal} observaciones</span></div>
    <svg viewBox="0 0 100 100" role="img" aria-label="Gráfico de histórico de precio"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5"/></svg>
    <div className="stats-grid">
      <span>Actual <b>{stats.currentPrice?.toFixed(2)} €</b></span>
      <span>Media 30 d <b>{stats.average30d?.toFixed(2) ?? "—"} €</b></span>
      <span>Media 90 d <b>{stats.average90d?.toFixed(2) ?? "—"} €</b></span>
      <span>Mínimo histórico <b>{stats.historicalMin?.toFixed(2)} €</b></span>
    </div>
  </section>;
}