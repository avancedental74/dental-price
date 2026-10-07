import type { PriceObservation, PriceHistoryStats } from "../domain/history";

export function HistoryPanel({history,stats}:{history:PriceObservation[];stats:PriceHistoryStats}){
  if(!history.length) return <section className="card history-card"><div className="section-head"><div><p className="eyebrow">HISTÓRICO</p><h3>Sin histórico comparable todavía</h3></div></div><p className="empty">El histórico se irá construyendo con costes unitarios efectivos verificados para esta misma cantidad de compra.</p></section>;
  const values=history.map(h=>h.effectiveUnitCost).filter((v):v is number=>typeof v==="number");
  if(!values.length) return <section className="card history-card"><div className="section-head"><div><p className="eyebrow">HISTÓRICO</p><h3>Datos económicos incompletos</h3></div></div><p className="empty">Hay observaciones, pero aún no tienen IVA y transporte suficientes para construir una serie comparable.</p></section>;
  const min=Math.min(...values),max=Math.max(...values),span=max-min || 1;
  const points=values.map((v,i)=>`${(i/(Math.max(1,values.length-1)))*100},${90-((v-min)/span)*70}`).join(" ");
  return <section className="card history-card">
    <div className="section-head"><div><p className="eyebrow">HISTÓRICO</p><h3>Coste unitario efectivo</h3></div><span>{stats.observationsTotal} observaciones · {stats.coverageDaysTotal.toFixed(0)} días</span></div>
    <svg viewBox="0 0 100 100" role="img" aria-label="Gráfico de coste unitario efectivo"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5"/></svg>
    <div className="stats-grid">
      <span>Actual <b>{stats.currentPrice?.toFixed(2) ?? "—"} €</b></span>
      <span>Media 30 d <b>{stats.average30d?.toFixed(2) ?? "—"} €</b></span>
      <span>Media 90 d <b>{stats.average90d?.toFixed(2) ?? "—"} €</b></span>
      <span>Mínimo histórico <b>{stats.historicalMin?.toFixed(2) ?? "—"} €</b></span>
    </div>
  </section>;
}