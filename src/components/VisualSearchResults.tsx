import {useMemo,useState} from "react";
import type {LiveSearchGroup} from "../services/live-prices";
import {normalizeName} from "../domain/matching/normalization";
import {compareSupplierOffers} from "../domain/comparison";
import {
  compareGloveAlternatives,extractGloveProperties,
  type GloveFacet,type GloveFilters,type GloveAlternative
} from "../features/gloves/compare";

type Item={group:LiveSearchGroup;properties:GloveFilters;type:string};
const facetLabels:Record<GloveFacet,string>={
  material:"Material",size:"Talla",powder:"Polvo",color:"Color",
  sterile:"Esterilidad",units:"Unidades por envase"
};
const facets:GloveFacet[]=["material","size","powder","sterile","color","units"];
const required:GloveFacet[]=["material","size","powder","sterile"];
const names:Record<string,string>={
  dentaltix:"Dentaltix",dentalcost:"DentalCost","dvd-dental":"DVD Dental",
  dentalexpress:"Dental Express",ortolan:"Ortolan",dentipak:"Dentipak",
  dentalboom:"Dental Boom",proclinic:"Proclinic","dental-iberica":"Dental Ibérica",
  brokerdental:"Broker Dental"
};
const money=(value:number)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(value);
export function describe(group:LiveSearchGroup):Item{
  const text=[group.label,group.product.variant,group.product.presentation].filter(Boolean).join(" ");
  const properties=extractGloveProperties(text);
  const isGlove=/\bguantes?\b/.test(normalizeName(text));
  return {group,properties:isGlove?properties:{},type:isGlove?(properties.material??"Material sin confirmar"):"Otros productos"};
}
export function matches(item:Item,filters:GloveFilters):boolean{
  return facets.every(k=>!filters[k]||item.properties[k]===filters[k]);
}
const label=(item:Item)=>[item.group.product.family,item.group.product.shade,item.group.product.variant].filter(Boolean).join(" · ");

function AlternativeTable({rows,onSelect,groups}:{
  rows:GloveAlternative[],groups:LiveSearchGroup[],onSelect:(group:LiveSearchGroup)=>void
}){
  return <div className="table-wrap alternative-table"><table>
    <thead><tr><th>Producto y características</th><th>Depósito</th><th>Envase</th><th>Coste envase*</th><th>Coste / 100 uds.*</th><th>Compra</th></tr></thead>
    <tbody>{rows.map((row,index)=><tr key={row.id}>
      <td><strong>{index===0&&rows.length>1?"Mejor coste encontrado · ":""}{row.name}</strong>
        <small className="source-note">{[row.properties.material,row.properties.size?"Talla "+row.properties.size:null,row.properties.powder,row.properties.sterile,row.reference?"Ref. "+row.reference:null].filter(Boolean).join(" · ")}</small>
      </td><td>{names[row.supplierId]??row.supplierId}</td>
      <td>{row.units} uds.</td>
      <td>{row.effectiveBoxCost===undefined?"—":money(row.effectiveBoxCost)}</td>
      <td><strong>{row.effectiveCostPer100===undefined?"—":money(row.effectiveCostPer100)}</strong></td>
      <td><div className="alternative-actions">
        <a href={row.productUrl} target="_blank" rel="noopener noreferrer">Ver en depósito ↗</a>
        <button type="button" onClick={()=>{const group=groups.find(g=>g.id===row.groupId);if(group)onSelect(group);}}>Detalle</button>
      </div></td>
    </tr>)}</tbody>
  </table></div>;
}

export function VisualSearchResults({items,query,onSelect,sessionId}:{
  items:LiveSearchGroup[];query:string;sessionId:string|null;onSelect:(group:LiveSearchGroup)=>void;
}){
  const [filters,setFilters]=useState<GloveFilters>({});
  const [category,setCategory]=useState("");
  const [expanded,setExpanded]=useState(true);
  const [preview,setPreview]=useState<string|null>(null);
  const [mode,setMode]=useState<"alternatives"|"exact">("alternatives");
  const analyzed=useMemo(()=>items.map(describe),[items]);
  const gloveSearch=/\bguantes?\b/.test(normalizeName(query));
  const counts=useMemo(()=>{
    const map=new Map<string,number>();
    for(const item of analyzed)map.set(item.type,(map.get(item.type)??0)+1);
    return [...map].sort((a,b)=>b[1]-a[1]);
  },[analyzed]);
  const byCategory=analyzed.filter(item=>!category||item.type===category);
  const facetValues=useMemo(()=>Object.fromEntries(facets.map(k=>{
    const values=new Map<string,number>();
    for(const item of byCategory.filter(candidate=>
      facets.every(other=>other===k||!filters[other]||candidate.properties[other]===filters[other]))){
      const value=item.properties[k];
      if(value)values.set(value,(values.get(value)??0)+1);
    }
    return [k,[...values.entries()]] as const;
  })) as Record<GloveFacet,Array<[string,number]>>,[byCategory,filters]);
  const visible=byCategory.filter(item=>matches(item,filters));
  const alternatives=useMemo(()=>compareGloveAlternatives(
    byCategory.map(item=>item.group),filters,sessionId
  ),[byCategory,filters,sessionId]);
  const updateFilter=(k:GloveFacet,value:string)=>setFilters(old=>({...old,[k]:old[k]===value?undefined:value}));
  const reset=()=>{setCategory("");setFilters({});};
  if(!items.length)return null;
  if(!gloveSearch)return <section className="card">
    <div className="section-head"><div><p className="eyebrow">RESULTADOS EN VIVO</p><h3>Selecciona el producto</h3></div><span>{items.length} coincidencias</span></div>
    <div className="smart-result-list">{analyzed.map(item=><button key={item.group.id} className="smart-result" onClick={()=>onSelect(item.group)}>
      <span><strong>{label(item)}</strong><small>{[item.group.product.presentation,item.group.manufacturerReference?"Ref. "+item.group.manufacturerReference:null,new Set(item.group.offers.map(o=>o.supplierId)).size+" proveedor(es)"].filter(Boolean).join(" · ")}</small></span><span>Comparar precios →</span>
    </button>)}</div>
  </section>;
  return <section className="card smart-search">
    <div className="section-head"><div><p className="eyebrow">RESULTADOS EN VIVO · GUANTES</p><h3>Compara sin perderte entre referencias</h3></div><span>{visible.length} de {items.length} productos</span></div>
    <div className="smart-mode-toggle" role="group" aria-label="Modalidad de comparación">
      <button type="button" className={mode==="alternatives"?"active":""} aria-pressed={mode==="alternatives"} onClick={()=>setMode("alternatives")}>Alternativas por características</button>
      <button type="button" className={mode==="exact"?"active":""} aria-pressed={mode==="exact"} onClick={()=>setMode("exact")}>Misma referencia exacta</button>
    </div>
    <p className="smart-mode-explain">{mode==="alternatives"
      ?"Compara marcas distintas que cumplen tus requisitos. No supone equivalencia clínica ni comercial."
      :"Compara exclusivamente ofertas del mismo artículo y su referencia de fabricante."}</p>
    <div className="smart-categories" aria-label="Material de los guantes">
      <button type="button" className={!category?"active":""} onClick={reset}>Todos <small>{items.length} productos</small></button>
      {counts.map(([type,count])=><button type="button" key={type} className={category===type?"active":""} onClick={()=>{setCategory(type);setFilters(old=>({...old,material:["Nitrilo","Látex","Vinilo"].includes(type)?type:undefined}));}}>
        <strong>{type}</strong><small>{count} opciones</small>
      </button>)}
    </div>
    <div className="smart-filter-header">
      <strong>Características {mode==="alternatives"?"para comparar":""}</strong>
      <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>{expanded?"Ocultar filtros":"Mostrar filtros"}</button>
      <button type="button" onClick={reset}>Limpiar todo</button>
    </div>
    {expanded&&<div className="smart-facets">{facets.filter(k=>facetValues[k].length>0).map(k=><fieldset key={k}>
      <legend>{facetLabels[k]} {mode==="alternatives"&&required.includes(k)?"*":""}</legend>
      <div className="smart-chips"><button type="button" className={!filters[k]?"active":""} onClick={()=>setFilters(old=>({...old,[k]:undefined}))}>Todos</button>
      {facetValues[k].map(([value,count])=><button type="button" key={value} className={filters[k]===value?"active":""} onClick={()=>updateFilter(k,value)}>
        {value} <small>({count})</small>
      </button>)}</div>
    </fieldset>)}</div>}
    {mode==="alternatives"?<div className="alternatives-section">
      <div className="smart-direct-head"><strong>Ofertas de distintas marcas</strong><p>Coste real de un envase con IVA y portes; se normaliza por 100 unidades sin modificar la cantidad que debes comprar.</p></div>
      {!alternatives.ready?<div className="alternatives-hint"><strong>Selecciona las características para una comparación justa.</strong>
        <p>Falta concretar: {alternatives.missingSelections.map(k=>facetLabels[k].toLowerCase()).join(", ")}. Los datos no publicados no se presuponen.</p>
      </div>:<>
        <p className="alternatives-count">{alternatives.ranked.length} ofertas comparables · {alternatives.unverified.length} pendientes de verificación</p>
        {alternatives.ranked.length>0
          ?<AlternativeTable rows={alternatives.ranked} groups={items} onSelect={onSelect}/>
          :<p className="smart-no-results">No hay precios suficientemente verificados para ordenar estas características. Puedes consultar las fichas individuales o cambiar filtros.</p>}
        {alternatives.unverified.length>0&&<details className="alternatives-pending">
          <summary>{alternatives.unverified.length} ofertas sin comparación fiable (ver motivos)</summary>
          <div className="alternatives-pending-list">{alternatives.unverified.map(row=><div key={row.id}><strong>{row.name}</strong><small>{names[row.supplierId]??row.supplierId} · {row.issues.join("; ")}</small></div>)}</div>
        </details>}
      </>}
      <p className="alternatives-footnote">* Precio por 100 unidades = coste del envase comprado (IVA y portes incluidos, cuando están confirmados) ÷ unidades del envase × 100. No es el precio de comprar exactamente 100 unidades. Solo se clasifican ofertas actuales, con identidad y stock verificados.</p>
    </div>:<>
      <div className="smart-direct-head"><strong>Elige un producto exacto</strong><p>Las referencias diferentes no compiten en el mismo ranking.</p></div>
      {!visible.length?<p className="smart-no-results">No hay coincidencias con estos filtros.</p>:
      <div className="smart-result-list">{visible.map(item=>{
        const result=preview===item.group.id?compareSupplierOffers(item.group.product,item.group.offers,1,{requiredLiveSessionId:sessionId??"__NO_LIVE_SESSION__"}):null;
        return <div key={item.group.id} className="smart-result-card">
          <div className="smart-result"><div className="smart-result-description">
            <strong>{label(item)}</strong>
            <small>{[item.properties.material,item.properties.size?"Talla "+item.properties.size:null,item.properties.powder,item.properties.units?item.properties.units+" uds.":null,item.group.manufacturerReference?"Ref. "+item.group.manufacturerReference:null].filter(Boolean).join(" · ")}</small>
            <small>{new Set(item.group.offers.map(o=>o.supplierId)).size} proveedor(es)</small>
          </div><div className="smart-result-actions">
            <button className="secondary-button" aria-expanded={preview===item.group.id} onClick={()=>setPreview(current=>current===item.group.id?null:item.group.id)}>{preview===item.group.id?"Ocultar precios":"Comparar aquí"}</button>
            <button className="primary-button" onClick={()=>onSelect(item.group)}>Ver detalles →</button>
          </div></div>
          {result&&<div className="smart-inline-comparison"><p>Comparación para 1 envase del mismo producto.</p>
            <div className="table-wrap"><table><thead><tr><th>Proveedor</th><th>Precio publicado</th><th>Coste efectivo</th><th>Estado</th></tr></thead>
            <tbody>{result.matches.map((m,index)=><tr key={m.offer.supplierId+"-"+(m.offer.supplierSku??index)}>
              <td>{names[m.offer.supplierId]??m.offer.supplierId}</td><td>{money(m.offer.salePrice??m.offer.regularPrice)}</td>
              <td>{m.eligibleForRanking&&m.pricing?money(m.pricing.effectiveTotalCost):"—"}</td>
              <td>{m.eligibleForRanking?"Verificada y comparable":"No comparable todavía"}</td>
            </tr>)}</tbody></table></div>
          </div>}
        </div>;
      })}</div>}
    </>}
  </section>;
}
