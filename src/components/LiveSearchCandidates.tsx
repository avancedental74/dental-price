import type { LiveSearchGroup } from "../services/live-prices";

export function LiveSearchCandidates({items,onSelect}:{items:LiveSearchGroup[];onSelect:(group:LiveSearchGroup)=>void}){
  if(!items.length) return null;
  return <section className="card">
    <div className="section-head">
      <div><p className="eyebrow">RESULTADOS ENCONTRADOS AHORA</p><h3>Elige el producto exacto</h3></div>
      <span>{items.length} coincidencias</span>
    </div>
    <div className="candidate-list">{items.map(group=>{
      const suppliers=new Set(group.offers.map(o=>o.supplierId)).size;
      const rep=group.product;
      return <button type="button" key={group.id} className="candidate-row" onClick={()=>onSelect(group)}>
        <span>
          <strong>{rep.family}{rep.shade?" · "+rep.shade:""}{rep.variant?" · "+rep.variant:""}</strong>
          <small>{[
            rep.presentation,
            rep.quantity&&rep.unit?rep.quantity+" "+rep.unit:null,
            group.manufacturerReference?"Ref. "+group.manufacturerReference:null,
            suppliers+" proveedor"+(suppliers===1?"":"es")
          ].filter(Boolean).join(" · ")}</small>
        </span>
        <b>{group.manufacturerReference?"Referencia detectada":"Revisar variante"}</b>
      </button>;
    })}</div>
  </section>;
}
