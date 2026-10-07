import { useEffect, useMemo, useState } from "react";
import type { CanonicalProduct, SupplierOffer } from "../types/domain";
import { compareSupplierOffers } from "../domain/comparison";
import { getFreshnessStatus } from "../domain/comparison/compare";
import { calculateHistoryStats } from "../domain/history";
import { opportunityFromHistory } from "../domain/opportunity";
import { normalizeName, normalizeReference } from "../domain/matching/normalization";
import { ComparisonTable } from "../components/ComparisonTable";
import { ConnectorStatusPanel } from "../components/ConnectorStatusPanel";
import { HistoryPanel } from "../components/HistoryPanel";
import { QuantityControl } from "../components/QuantityControl";
import { ScoreBadge } from "../components/ScoreBadge";
import { SearchBar } from "../components/SearchBar";
import { WinnerCard } from "../components/WinnerCard";
import { ManualOfferPanel } from "../components/ManualOfferPanel";
import { loadPublicData, type PublicData } from "../services/public-data";
import { loadManualOffers, saveManualOffers } from "../services/manual-offers";

function findProduct(products:CanonicalProduct[],query:string):CanonicalProduct|undefined{
  const q=normalizeName(query);
  const ref=normalizeReference(query);
  if(ref){
    const exact=products.find(p=>normalizeReference(p.manufacturerReference)===ref || normalizeReference(p.eanGtin)===ref);
    if(exact) return exact;
  }
  const tokens=q.split(" ").filter(Boolean);
  if(!tokens.length) return undefined;
  const ranked=products.map(product=>{
    const hay=normalizeName([product.manufacturer,product.family,product.productName,product.variant??"",product.shade??"",product.presentation,product.manufacturerReference??""].join(" "));
    const hits=tokens.filter(t=>hay.includes(t)).length;
    return {product,score:hits/tokens.length};
  }).sort((a,b)=>b.score-a.score);
  return ranked[0]?.score>=0.6 ? ranked[0].product : undefined;
}

export function App(){
  const [data,setData]=useState<PublicData|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [quantity,setQuantity]=useState(1);
  const [selected,setSelected]=useState<CanonicalProduct|null>(null);
  const [query,setQuery]=useState("");
  const [manualOffers,setManualOffers]=useState<SupplierOffer[]>(()=>loadManualOffers());

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
  const history=useMemo(()=>data&&selected&&winner?data.history.filter(h=>h.productId===selected.id&&h.requestedQuantity===quantity&&h.supplierId===winner.offer.supplierId):[],[data,selected,quantity,winner]);
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

  const onSearch=(q:string)=>{
    if(!data) return;
    setQuery(q);
    const found=findProduct(data.products,q);
    setSelected(found??null);
  };

  if(error) return <main className="app-shell"><section className="card"><h2>No se pudieron cargar los datos</h2><p>{error}</p></section></main>;
  if(!data) return <main className="app-shell"><section className="card"><h2>Cargando Dental Price…</h2></section></main>;

  return <main className="app-shell">
    <header className="topbar"><div><span className="brand-mark">DP</span><strong>DENTAL PRICE</strong></div><span className="live">{data.offers.length} automáticas · {manualOffers.length} manuales</span></header>
    <section className="hero">
      <p className="eyebrow">COMPRA INTELIGENTE PARA CLÍNICAS DENTALES</p>
      <h1>Compara el coste real, no solo el precio.</h1>
      <p className="subtitle">Datos públicos actualizados por conectores, matching exacto, promociones, portes e histórico.</p>
      <SearchBar onSearch={onSearch}/>
      <div className="hero-meta"><QuantityControl value={quantity} onChange={setQuantity}/><ScoreBadge score={score}/></div>
    </section>

    {!selected && <section className="card"><p className="eyebrow">SIN COINCIDENCIA</p><h2>No hay un producto del catálogo que coincida suficientemente con “{query}”.</h2><p>No se inventan equivalencias. Prueba con nombre, referencia de fabricante o EAN.</p></section>}

    {selected && <section className="product-head card"><div><p className="eyebrow">PRODUCTO CANÓNICO</p><h2>{selected.family}{selected.shade?` · ${selected.shade}`:""}{selected.variant?` ${selected.variant}`:""}</h2><p>{selected.presentation} {selected.quantity} {selected.unit} · Ref. {selected.manufacturerReference??"—"}</p></div><span className="query-chip">{query||selected.normalizedName}</span></section>}

    {selected && !winner && <section className="card"><p className="eyebrow">COMPARACIÓN</p><h2>Aún no hay una oferta elegible como ganadora.</h2><p>Puede deberse a falta de IVA/portes confirmados, datos antiguos, stock no disponible, anomalías o matching insuficiente.</p></section>}
    {winner && <WinnerCard item={winner}/>} 
    {comparison && <ComparisonTable items={comparison.matches}/>} 
    {selected && <HistoryPanel history={history} stats={stats}/>} 
    <ManualOfferPanel product={selected} offers={manualOffers} onChange={onManualOffersChange}/>
    <ConnectorStatusPanel items={data.connectors}/>
    <footer>Mejor precio encontrado entre los proveedores consultados · España peninsular · Nunca se inventan IVA, portes ni equivalencias.</footer>
  </main>;
}