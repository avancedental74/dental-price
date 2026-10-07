import type { PublicMetrics } from "../services/public-data";

export function MetricsPanel({metrics}:{metrics:PublicMetrics}){
  return <section className="card">
    <div className="section-head"><div><p className="eyebrow">COBERTURA REAL</p><h3>Qué puede decidir Dental Price hoy</h3></div><span>{new Date(metrics.generatedAt).toLocaleString("es-ES")}</span></div>
    <div className="stats-grid">
      <span>Ofertas verificadas <b>{metrics.verifiedOffers}</b><small>Identidad y precio observados ahora</small></span>
      <span>Ofertas comprables <b>{metrics.purchasableOffers}</b><small>Stock + IVA + portes + dato válido</small></span>
      <span>Productos comparables <b>{metrics.productsWithTwoOrMorePurchasableSuppliers}</b><small>≥2 proveedores comprables ahora</small></span>
      <span>Proveedores automáticos <b>{metrics.automaticSuppliers}</b><small>Fuentes que aportan precios actuales</small></span>
    </div>
  </section>;
}