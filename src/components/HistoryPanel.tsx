import type { PriceObservation, PriceHistoryStats } from "../domain/history";

export function HistoryPanel({history,stats}:{history:PriceObservation[];stats:PriceHistoryStats}){
  const values=history.map(h=>h.effectiveUnitCost ?? h.salePrice ?? h.regularPrice).filter(v=>Number.isFinite(v)&&v>0);
  if(!values.length){
    return <section className="card history-card"><div className="section-head"><div><p className="eyebrow">HISTÓRICO</p><h3>Aún no hay histórico comparable para esta cantidad</h3></div></div><p>El histórico se construirá automáticamente con las siguientes actualizaciones de precios.</p></section>;
  }
  const min=Math.min(...values),max=Math.max(...values),span=max-min || 1;
  const points=values.map((v,i)=>`${(i/(Math.max(1,values.length-1)))*100},${90-((v-min)/span)*70}`).join(" ");
  return <section className="card history-card">
    <div className="section-head"><div><p className="eyebrow">HISTÓRICO</p><h3>Evolución de coste unitario efectivo</h3></div><span>{stats.observationsTotal} observaciones · {stats.coverageDaysTotal.toFixed(0)} días</span></div>
    <svg viewBox="0 0 100 100" role="img" aria-label="Gráfico de histórico de coste unitario"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5"/></svg>
    {stats.coverageDaysTotal<30 && <p className="manual-note">El Opportunity Score necesita al menos 30 días de cobertura real. Faltan aproximadamente {Math.max(0,Math.ceil(30-stats.coverageDaysTotal))} días.</p>}
    <div className="stats-grid">
      <span>Actual <b>{stats.currentPrice?.toFixed(2) ?? "—"} €</b></span>
      <span>Media 30 d <b>{stats.average30d?.toFixed(2) ?? "—"} €</b></span>
      <span>Media 90 d <b>{stats.average90d?.toFixed(2) ?? "—"} €</b></span>
      <span>Mínimo histórico <b>{stats.historicalMin?.toFixed(2) ?? "—"} €</b></span>
    </div>
  </section>;
}