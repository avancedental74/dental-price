import type { ProductSearchResult } from "../domain/search";

export function SearchCandidates({items,onSelect}:{items:ProductSearchResult[];onSelect:(id:string)=>void}){
  if(items.length<2) return null;
  return <section className="card">
    <div className="section-head"><div><p className="eyebrow">COINCIDENCIAS</p><h3>Elige el producto exacto</h3></div><span>{items.length} candidatos</span></div>
    <div className="candidate-list">{items.map(({product,score,exactReference})=>
      <button type="button" key={product.id} className="candidate-row" onClick={()=>onSelect(product.id)}>
        <span><strong>{product.family}{product.shade ? " · "+product.shade : ""}{product.variant ? " "+product.variant : ""}</strong><small>{product.presentation} · {product.quantity} {product.unit} · Ref. {product.manufacturerReference??"—"}</small></span>
        <b>{exactReference ? "Referencia exacta" : Math.round(score*100)+"%"}</b>
      </button>
    )}</div>
  </section>;
}