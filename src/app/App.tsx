import { useEffect, useMemo, useState } from "react";
import { compareSupplierOffers } from "../domain/comparison";
import { calculateHistoryStats } from "../domain/history";
import { opportunityFromHistory } from "../domain/opportunity";
import { ComparisonTable } from "../components/ComparisonTable";
import { ConnectorStatus } from "../components/ConnectorStatus";
import { HistoryPanel } from "../components/HistoryPanel";
import { QuantityControl } from "../components/QuantityControl";
import { ScoreBadge } from "../components/ScoreBadge";
import { SearchBar } from "../components/SearchBar";
import { WinnerCard } from "../components/WinnerCard";
import { loadPublicData, type PublicData } from "../services/data";
import { searchProducts } from "../services/search";
import type { CanonicalProduct } from "../types/domain";

export function App(){
  const [data,setData]=useState<PublicData|null>(null);
  const [loading,setLoading]=useState(true);
  const [quantity,setQuantity]=useState(1);
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState<CanonicalProduct|null>(null);
  const [message,setMessage]=useState("Busca por nombre, referencia de fabricante o EAN.");

  useEffect(()=>{
    loadPublicData().then(payload=>{
      setData(payload);
      setSelected(payload.products[0] ?? null);
      setLoading(false);
    });
  },[]);

  const currentEntries=useMemo(()=>{
    if(!data || !selected) return [];
    return data.current.entries.filter(e=>e.productId===selected.id);
  },[data,selected]);

  const comparison=useMemo(()=>{
    if(!selected) return null;
    return compareSupplierOffers(selected,currentEntries.map(e=>e.offer),quantity);
  },[selected,currentEntries,quantity]);

  const productHistory=useMemo(()=>{
    if(!data || !selected) return [];
    return data.history.filter(h=>h.productId===selected.id && h.requestedQuantity===quantity);
  },[data,selected,quantity]);

  const stats=useMemo(()=>calculateHistoryStats(productHistory),[productHistory]);
  const score=useMemo(()=>{
    const best=comparison?.ranked[0];
    return opportunityFromHistory(productHistory,{
      isFresh:Boolean(best && new Date(best.offer.observedAt).getTime()>Date.now()-24*3600000),
      inStock:Boolean(best && (best.offer.stockStatus==="in_stock" || best.offer.stockStatus==="low_stock")),
      hasActivePromotion:Boolean(best?.offer.promotion)
    });
  },[productHistory,comparison]);

  function runSearch(value:string){
    setQuery(value);
    if(!data) return;
    const results=searchProducts(data.products,value);
    if(!results.length){
      setMessage("No encuentro ese producto en el catálogo validado todavía.");
      return;
    }
    setSelected(results[0].product);
    setMessage(results.length>1 ? `Mostrando la mejor coincidencia de ${results.length} resultados.` : "Producto identificado.");
  }

  if(loading) return <main className="app-shell"><section className="hero"><p>Cargando catálogo validado…</p></section></main>;
  if(!data) return <main className="app-shell"><section className="hero"><p>No se pudieron cargar los datos públicos.</p></section></main>;

  const winner=comparison?.ranked[0];
  const matches=comparison?.matches ?? [];
  return <main className="app-shell">
    <header className="topbar"><div><span className="brand-mark">DP</span><strong>DENTAL PRICE</strong></div><span className="live">{data.products.length} SKUs validados</span></header>
    <section className="hero">
      <p className="eyebrow">COMPRA INTELIGENTE PARA CLÍNICAS DENTALES</p>
      <h1>Compara el coste real, no solo el precio.</h1>
      <p className="subtitle">Catálogo real validado, matching exacto y precios públicos con trazabilidad. Los proveedores bloqueados o incompletos no pueden ganar automáticamente.</p>
      <SearchBar onSearch={runSearch}/>
      <p className="search-message">{message}</p>
      <div className="hero-meta"><QuantityControl value={quantity} onChange={setQuantity}/><ScoreBadge score={score}/></div>
    </section>

    {selected && <section className="product-head card"><div><p className="eyebrow">PRODUCTO</p><h2>{selected.family}{selected.shade?` · ${selected.shade}`:""}{selected.variant?` ${selected.variant}`:""}</h2><p>{selected.presentation} · {selected.packCount} × {selected.quantity} {selected.unit} · Ref. {selected.manufacturerReference ?? "—"}</p></div><span className="query-chip">{query || selected.manufacturerReference || selected.family}</span></section>}

    {winner ? <WinnerCard item={winner}/> : <section className="card no-winner"><p className="eyebrow">RESULTADO</p><h3>Sin ganador automático</h3><p>{matches.length ? "Hay ofertas encontradas, pero ninguna cumple a la vez identidad exacta, stock, frescura, IVA y transporte suficientes para comparar el coste final con seguridad." : "Aún no hay una oferta pública verificada para este SKU en los datos generados."}</p></section>}

    <ComparisonTable items={matches}/>
    <HistoryPanel history={productHistory} stats={stats}/>
    <ConnectorStatus data={data.connectors}/>
    <footer>Mejor precio encontrado entre los proveedores consultados · Nunca se completa con datos inventados.</footer>
  </main>;
}