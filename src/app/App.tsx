import { useEffect, useMemo, useRef, useState } from "react";
import type { CanonicalProduct, SupplierOffer } from "../types/domain";
import { compareSupplierOffers } from "../domain/comparison";
import { getFreshnessStatus } from "../domain/comparison/compare";
import { appendObservation, calculateHistoryStats, type PriceObservation } from "../domain/history";
import { opportunityFromHistory } from "../domain/opportunity";
import { calculatePricing } from "../domain/pricing";
import { normalizeName, normalizeReference } from "../domain/matching/normalization";
import { browserProtectedSupplierIds, liveAutomaticSupplierIds } from "../connectors/live-supplier-registry";
import { ComparisonTable } from "../components/ComparisonTable";
import { ConnectorStatusPanel } from "../components/ConnectorStatusPanel";
import { HistoryPanel } from "../components/HistoryPanel";
import { QuantityControl } from "../components/QuantityControl";
import { ScoreBadge } from "../components/ScoreBadge";
import { SearchBar } from "../components/SearchBar";
import { WinnerCard } from "../components/WinnerCard";
import { ManualOfferPanel } from "../components/ManualOfferPanel";
import { UniversalSearchResults } from "../components/UniversalSearchResults";
import { MetricsPanel } from "../components/MetricsPanel";
import { CoverageQueue } from "../components/CoverageQueue";
import { LiveSearchStatus, type LiveSearchState } from "../components/LiveSearchStatus";
import { BasketPanel, type BasketUiItem } from "../components/BasketPanel";
import { optimizeBasket } from "../domain/basket";
import { loadPublicData, type PublicData } from "../services/public-data";
import { searchLiveCatalog, type LiveSearchGroup, type SearchDepth } from "../services/live-prices";
import { loadLiveHistory, recordLiveSearchHistory, saveLiveHistory } from "../services/live-history";
import { loadManualHistory, loadManualOffers, saveManualHistory, saveManualOffers } from "../services/manual-offers";

export function App(){
  const [data,setData]=useState<PublicData|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [quantity,setQuantity]=useState(1);
  const [selected,setSelected]=useState<CanonicalProduct|null>(null);
  const [query,setQuery]=useState("");
  const [liveGroups,setLiveGroups]=useState<LiveSearchGroup[]>([]);
  const [searchDepth,setSearchDepth]=useState<SearchDepth>("standard");
  const [supplierCoverage,setSupplierCoverage]=useState<Array<{supplierId:string;offers:number;candidateLimitReached:boolean;queries:number;partialErrors:number;status:"results"|"no_match"|"error"}>>([]);
  const activeSearchId=useRef(0);
  const [manualOffers,setManualOffers]=useState<SupplierOffer[]>(()=>loadManualOffers());
  const [manualHistory,setManualHistory]=useState<PriceObservation[]>(()=>loadManualHistory());
  const [liveHistory,setLiveHistory]=useState<PriceObservation[]>(()=>loadLiveHistory());
  const [basket,setBasket]=useState<BasketUiItem[]>([]);
  const [basketOffers,setBasketOffers]=useState<Record<string,SupplierOffer[]>>({});
  const [basketRefreshing,setBasketRefreshing]=useState(false);
  const [basketRefreshedAt,setBasketRefreshedAt]=useState<string|undefined>();
  const [basketRefreshError,setBasketRefreshError]=useState<string|null>(null);
  const [liveOffers,setLiveOffers]=useState<SupplierOffer[]>([]);
  const [liveSessionId,setLiveSessionId]=useState<string|null>(null);
  const [liveState,setLiveState]=useState<LiveSearchState>("idle");
  const [liveCompletedAt,setLiveCompletedAt]=useState<string|undefined>();
  const [liveErrors,setLiveErrors]=useState<Array<{supplierId:string;message:string}>>([]);

  useEffect(()=>{loadPublicData().then(setData).catch(e=>setError(e instanceof Error?e.message:"Error cargando datos"));},[]);

  const selectLiveGroup=(group:LiveSearchGroup)=>{
    setSelected(group.product);
    setLiveOffers(group.offers);
    // Keep discovered alternatives so switching products does not require a new search.
    setLiveState(group.offers.length?(liveErrors.length?"partial":"success"):"failed");
  };

  const runFederatedSearch=async(q:string,keepSelection?:CanonicalProduct|null,depth:SearchDepth="standard")=>{
    if(!q.trim())return;
    const searchId=++activeSearchId.current;
    setQuery(q.trim());
    setSearchDepth(depth);
    setSupplierCoverage([]);
    setSelected(null);
    setLiveOffers([]);
    setLiveGroups([]);
    setLiveSessionId(null);
    setLiveErrors([]);
    setLiveCompletedAt(undefined);
    setLiveState("loading");
    try{
      const result=await searchLiveCatalog(q.trim(),data?[...data.history,...liveHistory]:liveHistory,undefined,depth);
      if(searchId!==activeSearchId.current)return;
      setSupplierCoverage(result.coverage);
      setLiveSessionId(result.sessionId);
      setLiveCompletedAt(result.completedAt);
      setLiveErrors(result.errors);
      if(data){
        setLiveHistory(current=>{
          const next=recordLiveSearchHistory(current,result.groups,data.products);
          saveLiveHistory(next);
          return next;
        });
      }
      const groups=result.groups;
      if(keepSelection){
        const ref=normalizeReference(keepSelection.manufacturerReference);
        const refreshed=groups.find(g=>ref&&normalizeReference(g.manufacturerReference)===ref);
        if(refreshed){
          setSelected(refreshed.product);
          setLiveOffers(refreshed.offers);
        }
      }
      // All searches share one result screen, including one-off exact references.
      // Never hide a unique result before the user sees its suppliers.
      setLiveGroups(groups);
      setLiveState(result.groups.length?(result.errors.length?"partial":"success"):"failed");
    }catch(e){
      if(searchId!==activeSearchId.current)return;
      const message=e instanceof Error?e.message:"LIVE_SEARCH_ERROR";
      setLiveState(message==="LIVE_API_NOT_CONFIGURED"?"unavailable":"failed");
      setLiveErrors(message==="LIVE_API_NOT_CONFIGURED"?[]:[{supplierId:"live-api",message}]);
    }
  };

  const runSeededLiveSearch=async(product:CanonicalProduct)=>{
    const lookup=product.manufacturerReference??product.family;
    await runFederatedSearch(lookup,product);
  };


  const comparison=useMemo(()=>selected?compareSupplierOffers(selected,liveOffers,quantity,{requiredLiveSessionId:liveSessionId??"__NO_LIVE_SESSION__"}):null,[selected,liveOffers,quantity,liveSessionId]);

  const basketComputation=useMemo(()=>{
    if(!basket.length)return {result:null,error:null as string|null};
    try{
      return {result:optimizeBasket(basket.map(item=>({product:item.product,quantity:item.quantity,offers:basketOffers[item.product.id]??[]}))),error:null};
    }catch(e){return {result:null,error:e instanceof Error?e.message:"La cesta necesita precios live de todos los productos"};}
  },[basket,basketOffers]);

  const winner=comparison?.ranked[0];
  const historyProductId=useMemo(()=>{
    if(!data||!selected?.manufacturerReference)return selected?.id;
    const ref=normalizeReference(selected.manufacturerReference);
    return data.products.find(p=>normalizeReference(p.manufacturerReference)===ref)?.id??selected.id;
  },[data,selected]);

  const history=useMemo(()=>data&&selected&&winner?[...data.history,...liveHistory,...manualHistory].filter(h=>h.productId===historyProductId&&h.requestedQuantity===quantity&&h.supplierId===winner.offer.supplierId):[],[data,selected,winner,historyProductId,quantity,manualHistory,liveHistory]);
  const stats=useMemo(()=>calculateHistoryStats(history),[history]);
  const score=useMemo(()=>opportunityFromHistory(history,{isFresh:winner?getFreshnessStatus(winner.offer)==="fresh":false,inStock:Boolean(winner&&(winner.offer.stockStatus==="in_stock"||winner.offer.stockStatus==="low_stock")),hasActivePromotion:Boolean(winner?.offer.promotion)}),[history,winner]);

  const onManualOffersChange=(next:SupplierOffer[])=>{setManualOffers(next);saveManualOffers(next);};
  const onManualObservation=(offer:SupplierOffer)=>{
    if(!selected)return;
    let unitCost:number|undefined,totalCost:number|undefined;
    try{const pricing=calculatePricing(offer,{requestedQuantity:quantity,includeVat:true});const incomplete=pricing.warnings.some(w=>w.includes("no confirmado")||w.includes("desconocida"));if(!incomplete){unitCost=pricing.effectiveUnitCost;totalCost=pricing.effectiveTotalCost;}}catch{ /* ignored: fallback path continues */ }
    const tagged={...offer,verificationKind:"manual" as const};
    const next=appendObservation(manualHistory,historyProductId??selected.id,tagged,unitCost,totalCost,quantity).history;
    setManualHistory(next);saveManualHistory(next);
  };

  const addSelectedToBasket=()=>{
    if(!selected)return;
    setBasketOffers(current=>({...current,[selected.id]:liveOffers}));
    setBasket(items=>{const existing=items.find(x=>x.product.id===selected.id);return existing?items.map(x=>x.product.id===selected.id?{...x,quantity:x.quantity+quantity}:x):[...items,{product:selected,quantity}];});
  };
  const changeBasketQuantity=(id:string,q:number)=>setBasket(items=>items.map(x=>x.product.id===id?{...x,quantity:q}:x));
  const removeBasketItem=(id:string)=>{
    setBasket(items=>items.filter(x=>x.product.id!==id));
    setBasketOffers(current=>{const next={...current};delete next[id];return next;});
  };

  const refreshWholeBasket=async()=>{
    if(!basket.length)return;
    setBasketRefreshing(true);
    setBasketRefreshError(null);
    try{
      const historyBase=data?[...data.history,...liveHistory]:liveHistory;
      const basketSessionId=crypto.randomUUID();
      const refreshed=await Promise.all(basket.map(async item=>{
        const lookup=item.product.manufacturerReference??item.product.family;
        const result=await searchLiveCatalog(lookup,historyBase,basketSessionId);
        const ref=normalizeReference(item.product.manufacturerReference);
        let group=ref?result.groups.find(g=>normalizeReference(g.manufacturerReference)===ref):undefined;
        if(!group){
          const wanted=normalizeName(item.product.family);
          group=result.groups.find(g=>{
            const label=normalizeName(g.label);
            return label===wanted||label.includes(wanted)||wanted.includes(label);
          });
        }
        return {id:item.product.id,offers:group?.offers??[]};
      }));
      setBasketOffers(Object.fromEntries(refreshed.map(x=>[x.id,x.offers])));
      setBasketRefreshedAt(new Date().toISOString());
    }catch(error){
      setBasketOffers({});
      setBasketRefreshedAt(undefined);
      setBasketRefreshError(error instanceof Error?error.message:"No se pudo actualizar toda la cesta en vivo.");
    }finally{
      setBasketRefreshing(false);
    }
  };
  const onSelectCoverage=(id:string)=>{const product=data?.products.find(p=>p.id===id);if(product)void runSeededLiveSearch(product);};

  if(error)return <main className="app-shell"><section className="card state-card"><span className="state-icon">!</span><h2>No se pudieron cargar los datos auxiliares</h2><p>{error}</p></section></main>;
  if(!data)return <main className="app-shell"><section className="card state-card"><div className="spinner"/><h2>Cargando Dental Price</h2><p>Preparando histórico y configuración.</p></section></main>;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">DP</span><div><strong>Dental Price</strong><small>Búsqueda federada en tiempo real</small></div></div>
      <div className="status-chip"><span className="status-dot"/>Consulta directa a proveedores</div>
    </header>

    <section className="hero">
      <div className="hero-copy">
        <span className="hero-kicker">BUSCADOR DENTAL EN TIEMPO REAL</span>
        <h1>Busca cualquier producto.<br/><span>Compara ahora.</span></h1>
        <p>Escribe una referencia o un nombre. Dental Price consulta los proveedores en ese momento, descubre las fichas disponibles y compara precios actuales. No necesitas que el producto exista previamente en nuestra base de datos.</p>
      </div>
      <div className="search-surface">
        <SearchBar onSearch={q=>void runFederatedSearch(q)}/>
        <div className="search-help"><span>Prueba con</span><button onClick={()=>void runFederatedSearch("41294")}>41294</button><button onClick={()=>void runFederatedSearch("Filtek Supreme A3")}>Filtek Supreme A3</button><button onClick={()=>void runFederatedSearch("Peeso nº3")}>Peeso nº3</button></div>
      </div>
      <div className="trust-row">
        <span><b>{liveAutomaticSupplierIds.length} live + {browserProtectedSupplierIds.length} protegidos</b> proveedores objetivo</span>
        <span><b>Live</b> precio y stock al consultar</span>
        <span><b>Exact</b> variantes separadas</span>
      </div>
    </section>

    {liveState==="loading"&&<LiveSearchStatus state="loading" errors={[]}/>}
    {!selected&&<UniversalSearchResults key={query+"|"+searchDepth} items={liveGroups} query={query} sessionId={liveSessionId} onSelect={selectLiveGroup} searchDepth={searchDepth} coverage={supplierCoverage} onExpand={()=>{void runFederatedSearch(query,null,"extended");}}/>}

    {!selected&&liveGroups.length===0&&query&&liveState!=="loading"&&<section className="card empty-card">
      <span className="empty-icon">⌕</span><h2>No encontramos “{query}” ahora</h2>
      <p>El producto no apareció en los buscadores accesibles de los proveedores en esta consulta. Prueba con la referencia exacta del fabricante o una descripción algo más corta.</p>
    </section>}

    {selected&&<section className="product-card card">
      <div className="product-main">
        <span className="product-label">ENCONTRADO EN VIVO</span>
        <h2>{selected.family}{selected.shade?" · "+selected.shade:""}{selected.variant?" · "+selected.variant:""}</h2>
        <p>{[selected.manufacturer,selected.presentation,selected.quantity&&selected.unit?selected.quantity+" "+selected.unit:null,selected.manufacturerReference?"Ref. "+selected.manufacturerReference:null].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="product-controls">
        <QuantityControl value={quantity} onChange={setQuantity}/>
        {liveGroups.length>0&&<button className="secondary-button" onClick={()=>{setSelected(null);setLiveOffers([]);}}>← Volver a resultados</button>}
        <button className="secondary-button" onClick={()=>void runFederatedSearch(query,selected)}>Consultar otra vez</button>
        <button className="primary-button" onClick={addSelectedToBasket}>Añadir a cesta</button>
      </div>
    </section>}

    {selected&&<LiveSearchStatus state={liveState} completedAt={liveCompletedAt} errors={liveErrors}/>}
    {winner&&<WinnerCard item={winner}/>}
    {selected&&!winner&&liveState!=="loading"&&<section className="card empty-card">
      <span className="empty-icon">—</span><h2>Encontrado, pero sin ganador seguro</h2>
      <p>Hay resultados actuales, pero todavía no podemos asegurar que una oferta tenga identidad, stock, IVA y portes suficientemente completos para declararla ganadora.</p>
    </section>}
    {comparison&&<ComparisonTable items={comparison.matches}/>}
    {selected&&<div className="insight-grid"><HistoryPanel history={history} stats={stats}/><ScoreBadge score={score}/></div>}

    <BasketPanel items={basket} result={basketComputation.result} error={basketRefreshError??basketComputation.error} onChangeQuantity={changeBasketQuantity} onRemove={removeBasketItem} onRefresh={()=>void refreshWholeBasket()} refreshing={basketRefreshing} refreshedAt={basketRefreshedAt}/>

    <details className="advanced-panel">
      <summary><span><b>Información avanzada</b><small>Histórico, cobertura y verificación manual</small></span><span className="chevron">⌄</span></summary>
      <div className="advanced-content">
        <MetricsPanel metrics={data.metrics}/>
        <CoverageQueue products={data.products} connectors={data.connectors} onSelect={onSelectCoverage}/>
        <ConnectorStatusPanel items={data.connectors}/>
        <ManualOfferPanel product={selected} offers={manualOffers} onChange={onManualOffersChange} onRecord={onManualObservation}/>
      </div>
    </details>

    <footer><strong>Dental Price</strong><span>El catálogo local es histórico; la búsqueda principal se hace en vivo.</span></footer>
  </main>;
}