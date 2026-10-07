import type { CanonicalProduct } from "../types/domain";
import type { BasketOptimizationResult } from "../domain/basket";

export interface BasketUiItem { product:CanonicalProduct; quantity:number; }

export function BasketPanel({items,result,onChangeQuantity,onRemove}:{items:BasketUiItem[];result:BasketOptimizationResult|null;onChangeQuantity:(id:string,q:number)=>void;onRemove:(id:string)=>void}){
  if(!items.length) return null;
  return <section className="card">
    <div className="section-head"><div><p className="eyebrow">CESTA OPTIMIZADA</p><h3>Compra conjunta</h3></div><span>{items.length} productos</span></div>
    <div className="basket-lines">{items.map(item=>
      <div className="basket-line" key={item.product.id}>
        <span><strong>{item.product.family}{item.product.shade?" · "+item.product.shade:""}</strong><small>Ref. {item.product.manufacturerReference??"—"}</small></span>
        <input aria-label={"Cantidad "+item.product.family} type="number" min="1" step="1" value={item.quantity} onChange={e=>onChangeQuantity(item.product.id,Math.max(1,Number(e.target.value)||1))}/>
        <button type="button" onClick={()=>onRemove(item.product.id)}>Quitar</button>
      </div>
    )}</div>
    {!result?.total && <p className="manual-note">No se puede optimizar todavía: falta al menos una oferta comprable para {result?.missingProductIds.length??0} producto(s).</p>}
    {result?.total!=null && <>
      <div className="basket-total"><span>Coste total optimizado</span><strong>{result.total.toFixed(2)} €</strong></div>
      <div className="basket-suppliers">{result.suppliers.map(s=><div key={s.supplierId}><strong>{s.supplierId}</strong><span>{s.lines} líneas · mercancía {s.merchandiseGross.toFixed(2)} € · portes {s.shipping.toFixed(2)} € · <b>{s.total.toFixed(2)} €</b></span></div>)}</div>
    </>}
  </section>;
}