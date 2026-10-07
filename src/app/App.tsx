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
import { CoverageQueue } from "../components/CoverageQueue";
import { LiveSearchStatus, type LiveSearchState } from "../components/LiveSearchStatus";
import { BasketPanel, type BasketUiItem } from "../components/BasketPanel";
import { optimizeBasket } from "../domain/basket";
import { loadPublicData, type PublicData } from "../services/public-data";
import { fetchLivePrices } from "../services/live-prices";
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
  const [basket,setBasket]=useState<BasketUiItem[]>([]);
  const [liveOffers,setLiveOffers]=useState<SupplierOffer[]>([]);
  const [liveSessionId,setLiveSessionId]=useState<string|null>(null);
  const [liveState,setLiveState]=useState<LiveSearchState>("idle");
  const [liveCompletedAt,setLiveCompletedAt]=useState<string|undefined>();
  const [liveErrors,setLiveErrors]=useState<Array<{supplierId:string;message:string}>>([]);

  useEffect(()=>{ loadPublicData().then(setData).catch(e=>setError(e instanceof Error?e.message:"Error cargando datos")); },[]);

  const runLiveSearch=async(product:CanonicalProduct)=>{
    setLiveOffers([]); setLiveSessionId(null); setLiveErrors([]); setLiveCompletedAt(undefined); setLiveState("loading");
    try{
      const result=await fetchLivePrices(product.id);
      setLiveOffers(result.offers); setLiveSessionId(result.sessionId); setLiveErrors(result.errors); setLiveCompletedAt(result.completedAt);
      setLiveState(result.offers.length===0?"failed":result.errors.length?"partial":"success");
    }catch(e){
      const message=e instanceof Error?e.message:"LIVE_API_ERROR";
      setLiveState(message==="LIVE_API_NOT_CONFIGURED"?"unavailable":"failed");
      setLiveErrors(message==="LIVE_API_NOT_CONFIGURED"?[]:[{supplierId:"live-api",message}]);
    }
  };

  const selectProduct=(product:CanonicalProduct|null)=>{
    setSelected(product); setSearchCandidates([]);
    if(product) void runLiveSearch(product);
    else { setLiveOffers([]); setLiveSessionId(null); setLiveState("idle"); }
  };

  const candidates=useMemo(()=>{
    if(!data||!selected) return [];
    const ref=normalizeReference(selected.manufacturerReference);
    const family=normalizeName(selected.family);
    const snapshots=data.offers.map(o=>({...o,verificationKind:o.verificationKind??"snapshot" as const}));
    const manuals=manualOffers.map(o=>({...o,verificationKind:o.verificationKind??"manual" as const}));
    return [...liveOffers,...snapshots,...manuals].filter(o=>(ref&&normalizeReference(o.manufacturerReference)===ref)||normalizeName(o.normalizedName).includes(family));
  },[data,selected,manualOffers,liveOffers]);

  const comparison=useMemo(()=>selected?compareSupplierOffers(selected,candidates,quantity,{requiredLiveSessionId:liveSessionId??"__NO_LIVE_SESSION__"}):null,[selected,candidates,quantity,liveSessionId]);
  const basketComputation=useMemo(()=>{
    if(!data||!basket.length) return {result:null,error:null as string|null};
    try{
      return {result:optimizeBasket(basket.map(item=>({product:item.product,quantity:item.quantity,offers:liveOffers.filter(o=>normalizeReference(o.manufacturerReference)===normalizeReference(item.product.manufacturerReference))}))),error:null};
    }catch(error){ return {result:null,error:error instanceof Error?error.message:"La cesta requiere precios live de todos sus productos"}; }
  },[data,basket,liveOffers]);

  const basketResult=basketComputation.result;
  const winner=comparison?.ranked[0];
  const history=useMemo(()=>data&&selected&&winner?[...data.history,...manualHistory].filter(h=>h.productId===selected.id&&h.requestedQuantity===quantity&&h.supplierId===winner.offer.supplierId):[],[data,selected,quantity,winner,manualHistory]);
  const stats=useMemo(()=>calculateHistoryStats(history),[history]);
  const score=useMemo(()=>opportunityFromHistory(history,{isFresh:winner?getFreshnessStatus(winner.offer)==="fresh":false,inStock:Boolean(winner&&(winner.offer.stockStatus==="in_stock"||winner.offer.stockStatus==="low_stock")),hasActivePromotion:Boolean(winner?.offer.promotion)}),[history,winner]);

  const onManualOffersChange=(next:SupplierOffer[])=>{setManualOffers(next);saveManualOffers(next);};
  const onManualObservation=(offer:SupplierOffer)=>{
    if(!selected) return;
    let unitCost:number|undefined,totalCost:number|undefined;
    try{const pricing=calculatePricing(offer,{requestedQuantity:quantity,includeVat:true});const incomplete=pricing.warnings.some(w=>w.includes("no confirmado")||w.includes("desconocida"));if(!incomplete){unitCost=pricing.effectiveUnitCost;totalCost=pricing.effectiveTotalCost;}}catch{ /* non-rankable */ }
    const tagged={...offer,verificationKind:"manual" as const};
    const next=appendObservation(manualHistory,selected.id,tagged,unitCost,totalCost,quantity).history;
    setManualHistory(next);saveManualHistory(next);
  };

  const onSearch=(q:string)=>{
    if(!data||!q) return;
    setQuery(q);
    const results=searchProducts(data.products,q);
    setSearchCandidates(results);
    if(results.length===1||results[0]?.exactReference) selectProduct(results[0]?.product??null);
    else selectProduct(null);
  };

  const addSelectedToBasket=()=>{
    if(!selected) return;
    setBasket(items=>{const existing=items.find(x=>x.product.id===selected.id);return existing?items.map(x=>x.product.id===selected.id?{...x,quantity:x.quantity+quantity}:x):[...items,{product:selected,quantity}];});
  };
  const changeBasketQuantity=(id:string,q:number)=>setBasket(items=>items.map(x=>x.product.id===id?{...x,quantity:q}:x));
  const removeBasketItem=(id:string)=>setBasket(items=>items.filter(x=>x.product.id!==id));
  const onSelectCandidate=(id:string)=>{if(data) selectProduct(data.products.find(p=>p.id===id)??null);};

  if(error) return <main className="app-shell"><section className="card state-card"><span className="state-icon">!</span><h2>No se pudieron cargar los datos</h2><p>{error}</p></section></main>;
  if(!data) return <main className="app-shell"><section className="card state-card"><div className="spinner"/><h2>Cargando Dental Price</h2><p>Preparando catálogo y precios.</p></section></main>;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">DP</span><div><strong>Dental Price</strong><small>Compras inteligentes para clínica</small></div></div>
      <div className="status-chip"><span className="status-dot"/>Precios en vivo</div>
    </header>

    <section className="hero">
      <div className="hero-copy">
        <span className="hero-kicker">COMPARADOR DENTAL EN TIEMPO REAL</span>
        <h1>Encuentra el mejor precio.<br/><span>Ahora.</span></h1>
        <p>Busca un producto y compararemos los proveedores disponibles en ese momento. Sin mezclar precios actuales con históricos.</p>
      </div>
      <div className="search-surface">
        <SearchBar onSearch={onSearch}/>
        <div className="search-help"><span>Prueba con</span><button onClick={()=>onSearch("4910A3B")}>4910A3B</button><button onClick={()=>onSearch("Filtek Supreme")}>Filtek Supreme</button><button onClick={()=>onSearch("Peeso")}>Peeso</button></div>
      </div>
      <div className="trust-row">
        <span><b>{data.metrics.verifiedOffers}</b> ofertas verificadas</span>
        <span><b>{data.metrics.automaticSuppliers}</b> proveedores automáticos</span>
        <span><b>{data.metrics.productsWithTwoOrMorePurchasableSuppliers}</b> productos comparables</span>
      </div>
    </section>

    <SearchCandidates items={searchCandidates} onSelect={onSelectCandidate}/>
    {!selected&&searchCandidates.length===0&&query&&<section className="card empty-card"><span className="empty-icon">⌕</span><h2>No encontramos “{query}”</h2><p>Prueba con el nombre comercial, la referencia del fabricante o el EAN.</p></section>}

    {selected&&<section className="product-card card">
      <div className="product-main">
        <span className="product-label">{selected.category}</span>
        <h2>{selected.family}{selected.shade?` · ${selected.shade}`:""}{selected.variant?` ${selected.variant}`:""}</h2>
        <p>{selected.presentation} · {selected.quantity} {selected.unit} · Ref. {selected.manufacturerReference??"—"}</p>
      </div>
      <div className="product-controls"><QuantityControl value={quantity} onChange={setQuantity}/><button className="secondary-button" onClick={()=>void runLiveSearch(selected)}>Actualizar</button><button className="primary-button" onClick={addSelectedToBasket}>Añadir a cesta</button></div>
    </section>}

    {selected&&<LiveSearchStatus state={liveState} completedAt={liveCompletedAt} errors={liveErrors}/>}
    {winner&&<WinnerCard item={winner}/>}
    {selected&&!winner&&liveState!=="loading"&&<section className="card empty-card"><span className="empty-icon">—</span><h2>Sin ganador verificable ahora</h2><p>Ninguna oferta live cumple todavía identidad, stock y coste completo. Los snapshots de abajo quedan solo como referencia.</p></section>}
    {comparison&&<ComparisonTable items={comparison.matches}/>}
    {selected&&<div className="insight-grid"><HistoryPanel history={history} stats={stats}/><ScoreBadge score={score}/></div>}
    <BasketPanel items={basket} result={basketResult} error={basketComputation.error} onChangeQuantity={changeBasketQuantity} onRemove={removeBasketItem}/>

    <details className="advanced-panel">
      <summary><span><b>Información avanzada</b><small>Cobertura, fuentes y verificación manual</small></span><span className="chevron">⌄</span></summary>
      <div className="advanced-content">
        <MetricsPanel metrics={data.metrics}/>
        <CoverageQueue products={data.products} connectors={data.connectors} onSelect={onSelectCandidate}/>
        <ConnectorStatusPanel items={data.connectors}/>
        <ManualOfferPanel product={selected} offers={manualOffers} onChange={onManualOffersChange} onRecord={onManualObservation}/>
      </div>
    </details>

    <footer><strong>Dental Price</strong><span>Precios actuales cuando pueden verificarse. Histórico cuando no.</span></footer>
  </main>;
}