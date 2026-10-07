import { useEffect, useMemo, useState } from "react";
import type { CanonicalProduct, SupplierOffer } from "../types/domain";
import { compareSupplierOffers } from "../domain/comparison";
import { getFreshnessStatus } from "../domain/comparison/compare";
import { appendObservation, calculateHistoryStats, type PriceObservation } from "../domain/history";
import { opportunityFromHistory } from "../domain/opportunity";
import { calculatePricing } from "../domain/pricing";
import { normalizeName, normalizeReference } from "../domain/matching/normalization";
import { searchProducts, type ProductSearchResult } from "../domain/search";
import { ComparisonTable } from "../components/ComparisonTable";
import { ConnectorStatusPanel } from "../components/ConnectorStatusPanel";
import { HistoryPanel } from "../components/HistoryPanel";
import { QuantityControl } from "../components/QuantityControl";
import { ScoreBadge } from "../components/ScoreBadge";
import { SearchBar } from "../components/SearchBar";
import { WinnerCard } from "../components/WinnerCard";
import { ManualOfferPanel } from "../components/ManualOfferPanel";
import { SearchCandidates } from "../components/SearchCandidates";
import { MetricsPanel } from "../components/MetricsPanel";
import { loadPublicData, type PublicData } from "../services/public-data";
import { loadManualHistory, loadManualOffers, saveManualHistory, saveManualOffers } from "../services/manual-offers";

export function App(){
  const [data,setData]=useState<PublicData|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [quantity,setQuantity]=useState(1);
  const [selected,setSelected]=useState<CanonicalProduct|null>(null);
  const [query,setQuery]=useState("");
  const [searchCandidates,setSearchCandidates]=useState<ProductSearchResult[]>([]);
  const [manualOffers,setManualOffers]=useState<SupplierOffer[]>(()=>loadManualOffers());
  const [manualHistory,setManualHistory]=useState<PriceObservation[]>(()=>loadManualHistory());

  useEffect(()=>{
    loadPublicData().then(d=>{setData(d);setSelected(d.products[0]??null);}).catch(e=>setError(e instanceof Error?e.message:"Error cargando datos"));
  },[]);

  const candidates=useMemo(()=>{
    if(!data||!selected) return [];
    const ref=normalizeReference(selected.manufacturerReference);
    const family=normalizeName(selected.family);
    const allOffers=[...data.offers,...manualOffers];
    return allOffers.filter(o=>
      (ref && normalizeReference(o.manufacturerReference)===ref) ||
      normalizeName(o.normalizedName).includes(family)
    );
  },[data,selected,manualOffers]);

  const comparison=useMemo(()=>selected?compareSupplierOffers(selected,candidates,quantity):null,[selected,candidates,quantity]);
  const winner=comparison?.ranked[0];
  const history=useMemo(()=>data&&selected&&winner?[...data.history,...manualHistory].filter(h=>h.productId===selected.id&&h.requestedQuantity===quantity&&h.supplierId===winner.offer.supplierId):[],[data,selected,quantity,winner,manualHistory]);
  const stats=useMemo(()=>calculateHistoryStats(history),[history]);
  const score=useMemo(()=>opportunityFromHistory(history,{
    isFresh:winner?getFreshnessStatus(winner.offer)==="fresh":false,
    inStock:Boolean(winner&&(winner.offer.stockStatus==="in_stock"||winner.offer.stockStatus==="low_stock")),
    hasActivePromotion:Boolean(winner?.offer.promotion)
  }),[history,winner]);

  const onManualOffersChange=(next:SupplierOffer[])=>{
    setManualOffers(next);
    saveManualOffers(next);
  };
  const onManualObservation=(offer:SupplierOffer)=>{
    if(!selected) return;
    let unitCost:number|undefined,totalCost:number|undefined;
    try{
      const pricing=calculatePricing(offer,{requestedQuantity:quantity,includeVat:true});
      const incomplete=pricing.warnings.some(w=>w.includes("no confirmado")||w.includes("desconocida"));
      if(!incomplete){unitCost=pricing.effectiveUnitCost;totalCost=pricing.effectiveTotalCost;}
    }catch{ /* invalid economic data remains non-rankable and history keeps raw fields */ }
    const next=appendObservation(manualHistory,selected.id,offer,unitCost,totalCost,quantity).history;
    setManualHistory(next);
    saveManualHistory(next);
  };

  const onSearch=(q:string)=>{
    if(!data) return;
    setQuery(q);
    const results=searchProducts(data.products,q);
    setSearchCandidates(results);
    if(results.length===1 || results[0]?.exactReference){
      setSelected(results[0]?.product??null);
      setSearchCandidates([]);
    }else{
      setSelected(null);
    }
  };
  const onSelectCandidate=(id:string)=>{
    if(!data) return;
    setSelected(data.products.find(p=>p.id===id)??null);
    setSearchCandidates([]);
  };

  if(error) return <main className="app-shell"><section className="card"><h2>No se pudieron cargar los datos</h2><p>{error}</p></section></main>;
  if(!data) return <main className="app-shell"><section className="card"><h2>Cargando Dental Price…</h2></section></main>;

  return <main className="app-shell">
    <header className="topbar"><div><span className="brand-mark">DP</span><strong>DENTAL PRICE</strong></div><span className="live">{data.offers.length} automáticas · {manualOffers.length} manuales</span></header>
    <MetricsPanel metrics={data.metrics}/>
    <section className="hero">
      <p className="eyebrow">COMPRA INTELIGENTE PARA CLÍNICAS DENTALES</p>
      <h1>Compara el coste real, no solo el precio.</h1>
      <p className="subtitle">Datos públicos actualizados por conectores, matching exacto, promociones, portes e histórico.</p>
      <SearchBar onSearch={onSearch}/>
      <div className="hero-meta"><QuantityControl value={quantity} onChange={setQuantity}/><ScoreBadge score={score}/></div>
    </section>

    <SearchCandidates items={searchCandidates} onSelect={onSelectCandidate}/>
    {!selected && searchCandidates.length===0 && query && <section className="card"><p className="eyebrow">SIN COINCIDENCIA</p><h2>No hay un producto del catálogo que coincida suficientemente con “{query}”.</h2><p>No se inventan equivalencias. Prueba con nombre, referencia de fabricante o EAN.</p></section>}

    {selected && <section className="product-head card"><div><p className="eyebrow">PRODUCTO CANÓNICO</p><h2>{selected.family}{selected.shade?` · ${selected.shade}`:""}{selected.variant?` ${selected.variant}`:""}</h2><p>{selected.presentation} {selected.quantity} {selected.unit} · Ref. {selected.manufacturerReference??"—"}</p></div><span className="query-chip">{query||selected.normalizedName}</span></section>}

    {selected && !winner && <section className="card"><p className="eyebrow">COMPARACIÓN</p><h2>Aún no hay una oferta elegible como ganadora.</h2><p>Puede deberse a falta de IVA/portes confirmados, datos antiguos, stock no disponible, anomalías o matching insuficiente.</p></section>}
    {winner && <WinnerCard item={winner}/>} 
    {comparison && <ComparisonTable items={comparison.matches}/>} 
    {selected && <HistoryPanel history={history} stats={stats}/>} 
    <ManualOfferPanel product={selected} offers={manualOffers} onChange={onManualOffersChange} onRecord={onManualObservation}/>
    <ConnectorStatusPanel items={data.connectors}/>
    <footer>Mejor precio encontrado entre los proveedores consultados · España peninsular · Nunca se inventan IVA, portes ni equivalencias.</footer>
  </main>;
}