import { useMemo, useState } from "react";
import { compareSupplierOffers } from "../domain/comparison";
import { calculateHistoryStats } from "../domain/history";
import { opportunityFromHistory } from "../domain/opportunity";
import { ComparisonTable } from "../components/ComparisonTable";
import { HistoryPanel } from "../components/HistoryPanel";
import { QuantityControl } from "../components/QuantityControl";
import { ScoreBadge } from "../components/ScoreBadge";
import { SearchBar } from "../components/SearchBar";
import { WinnerCard } from "../components/WinnerCard";
import { demoHistory, demoOffers, demoProduct } from "./mock-data";

export function App(){
  const [quantity,setQuantity]=useState(4);
  const [query,setQuery]=useState("Filtek Supreme XTE A3 Body");
  const comparison=useMemo(()=>compareSupplierOffers(demoProduct,demoOffers,quantity),[quantity]);
  const stats=useMemo(()=>calculateHistoryStats(demoHistory,new Date("2026-10-07T12:00:00.000Z")),[]);
  const score=useMemo(()=>opportunityFromHistory(demoHistory,{now:new Date("2026-10-07T12:00:00.000Z"),isFresh:true,inStock:true,hasActivePromotion:true}),[]);
  const winner=comparison.ranked[0];
  return <main className="app-shell">
    <header className="topbar"><div><span className="brand-mark">DP</span><strong>DENTAL PRICE</strong></div><span className="live">MVP · 3 proveedores</span></header>
    <section className="hero">
      <p className="eyebrow">COMPRA INTELIGENTE PARA CLÍNICAS DENTALES</p>
      <h1>Compara el coste real, no solo el precio.</h1>
      <p className="subtitle">Matching exacto, promociones, portes e histórico en una sola vista.</p>
      <SearchBar onSearch={q=>setQuery(q || query)}/>
      <div className="hero-meta"><QuantityControl value={quantity} onChange={setQuantity}/><ScoreBadge score={score}/></div>
    </section>
    <section className="product-head card"><div><p className="eyebrow">PRODUCTO</p><h2>{demoProduct.family} · {demoProduct.shade} {demoProduct.variant}</h2><p>{demoProduct.presentation} {demoProduct.quantity} {demoProduct.unit} · Ref. {demoProduct.manufacturerReference}</p></div><span className="query-chip">{query}</span></section>
    {winner && <WinnerCard item={winner}/>} 
    <ComparisonTable items={comparison.matches}/>
    <HistoryPanel history={demoHistory} stats={stats}/>
    <footer>Mejor precio encontrado entre los proveedores consultados · Datos demo de Fase 10</footer>
  </main>;
}