import {useMemo,useState} from "react";
import type {LiveSearchGroup} from "../services/live-prices";
import {normalizeName} from "../domain/matching/normalization";
import {compareSupplierOffers} from "../domain/comparison";

type Attribute="material"|"size"|"powder"|"color"|"sterile"|"units";
type Filters=Partial<Record<Attribute,string>>;
type Item={group:LiveSearchGroup;properties:Filters;type:string};
const facetLabels:Record<Attribute,string>={material:"Material",size:"Talla",powder:"Polvo",color:"Color",sterile:"Esterilidad",units:"Unidades por envase"};
const facets:Attribute[]=["material","size","powder","color","sterile","units"];
const cleaned=(v:string)=>normalizeName(v).replace(/[.,;:()]/g," ").replace(/\s+/g," ").trim();
const match=(text:string,re:RegExp)=>re.test(text);
export function describe(group:LiveSearchGroup):Item{
  const p=group.product;
  const t=cleaned([p.family,p.variant,p.presentation].filter(Boolean).join(" "));
  const glove=match(t,/\bguantes?\b/);
  const material=match(t,/\bnitrilo\b/)?"Nitrilo":match(t,/\blatex\b/)?"Látex":match(t,/\bvinilo\b/)?"Vinilo":undefined;
  const sterile=match(t,/\bno esteril(?:es)?\b/)?"No estériles":match(t,/\besteril(?:es)?\b/)?"Estériles":undefined;
  const powder=match(t,/\bsin polvo\b/)?"Sin polvo":match(t,/\bcon polvo\b/)?"Con polvo":undefined;
  const color=match(t,/\bazules?\b/)?"Azul":match(t,/\bnegros?\b/)?"Negro":match(t,/\bblancos?\b/)?"Blanco":undefined;
  const size=t.match(/\b(?:talla\s*)?(xs|xl|xxl|s|m|l)\b/)?.[1]?.toUpperCase()
    ??t.match(/\b(?:talla\s*)?(?:n[º°o.]?\s*)(\d+(?:[.,]\d+)?)\b/)?.[1];
  const units=t.match(/\b(?:caja|pack|bolsa)?\s*(?:de\s*)?(\d{2,4})\s*(?:uds?|unidades)\b/)?.[1]
    ??(p.packCount>1?String(p.packCount):undefined);
  return {group,properties:glove?{material,size,powder,color,sterile,units}:{},type:glove?(sterile==="Estériles"?"Estériles":material??"Otros guantes"):"Otros productos"};
}
export function matches(item:Item,filters:Filters):boolean{
  return facets.every(k=>!filters[k]||item.properties[k]===filters[k]);
}
function label(item:Item):string{
  const p=item.group.product;
  return [p.family,p.shade,p.variant].filter(Boolean).join(" · ");
}
export function VisualSearchResults({items,query,onSelect,sessionId}:{
  items:LiveSearchGroup[];query:string;sessionId:string|null;onSelect:(group:LiveSearchGroup)=>void;
}){
  const [filters,setFilters]=useState<Filters>({});
  const [category,setCategory]=useState<string>("");
  const [expanded,setExpanded]=useState(true);
  const [preview,setPreview]=useState<string|null>(null);
  const analyzed=useMemo(()=>items.map(describe),[items]);
  const gloveSearch=match(cleaned(query),/\bguantes?\b/);
  const counts=useMemo(()=>{
    const map=new Map<string,number>();
    for(const item of analyzed)map.set(item.type,(map.get(item.type)??0)+1);
    return [...map].sort((a,b)=>b[1]-a[1]);
  },[analyzed]);
  const byCategory=analyzed.filter(i=>!category||i.type===category);
  const facetValues=useMemo(()=>Object.fromEntries(facets.map(k=>{
    const values=new Map<string,number>();
    for(const item of byCategory.filter(i=>facets.every(other=>other===k||!filters[other]||item.properties[other]===filters[other]))){
      const v=item.properties[k];if(v)values.set(v,(values.get(v)??0)+1);
    }
    return [k,[...values.entries()]] as const;
  })) as Record<Attribute,Array<[string,number]>>,[byCategory,filters]);
  const visible=byCategory.filter(item=>matches(item,filters));
  if(!items.length)return null;
  if(!gloveSearch)return <section className="card">
    <div className="section-head"><div><p className="eyebrow">RESULTADOS EN VIVO</p><h3>Selecciona el producto</h3></div><span>{items.length} coincidencias</span></div>
    <div className="smart-result-list">{items.map(g=><button key={g.id} className="smart-result" onClick={()=>onSelect(g)}>
      <span><strong>{label({group:g,properties:{},type:""})}</strong><small>{[g.product.presentation,g.manufacturerReference?"Ref. "+g.manufacturerReference:null,new Set(g.offers.map(o=>o.supplierId)).size+" proveedor(es)"].filter(Boolean).join(" · ")}</small></span><span>Comparar precios →</span>
    </button>)}</div>
  </section>;
  return <section className="card smart-search">
    <div className="section-head"><div><p className="eyebrow">RESULTADOS EN VIVO · GUANTES</p><h3>Encuentra lo que necesitas</h3></div><span>{visible.length} de {items.length} opciones</span></div>
    <div className="smart-categories" aria-label="Tipos de guantes">
      <button className={!category?"active":""} onClick={()=>{setCategory("");setFilters({});}}>Todos <small>{items.length}</small></button>
      {counts.map(([type,count])=><button key={type} className={category===type?"active":""} onClick={()=>{setCategory(type);setFilters({});}}>
        <strong>{type}</strong><small>{count} opciones</small>
      </button>)}
    </div>
    <div className="smart-filter-header"><strong>Afina la búsqueda</strong><button onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>{expanded?"Ocultar filtros":"Mostrar filtros"}</button><button onClick={()=>{setCategory("");setFilters({});}}>Limpiar todo</button></div>
    {expanded&&<div className="smart-facets">{facets.filter(k=>facetValues[k].length>0).map(k=><fieldset key={k}>
      <legend>{facetLabels[k]}</legend>
      <div className="smart-chips"><button className={!filters[k]?"active":""} onClick={()=>setFilters(old=>({...old,[k]:undefined}))}>Todos</button>
      {facetValues[k].map(([value,count])=><button key={value} className={filters[k]===value?"active":""} onClick={()=>setFilters(old=>({...old,[k]:old[k]===value?undefined:value}))}>{value} <small>({count})</small></button>)}</div>
    </fieldset>)}</div>}
    <div className="smart-direct-head"><div><strong>Productos y proveedores encontrados</strong><p>Elige una referencia para consultar su coste efectivo, stock y portes. Los artículos distintos no compiten entre sí.</p></div></div>
    {!visible.length?<p className="smart-no-results">No hay coincidencias con estos filtros. Prueba a quitar uno.</p>:
    <div className="smart-result-list">{visible.map(item=>{
      const result=preview===item.group.id?compareSupplierOffers(item.group.product,item.group.offers,1,{requiredLiveSessionId:sessionId??"__NO_LIVE_SESSION__"}):null;
      return <div key={item.group.id} className="smart-result-card">
        <div className="smart-result">
          <div className="smart-result-description"><strong>{label(item)}</strong><small>{[item.properties.material,item.properties.size?"Talla "+item.properties.size:null,item.properties.powder,item.properties.units?item.properties.units+" uds.":null,item.group.manufacturerReference?"Ref. "+item.group.manufacturerReference:null].filter(Boolean).join(" · ")}</small><small>{new Set(item.group.offers.map(o=>o.supplierId)).size} proveedor(es) encontrados</small></div>
          <div className="smart-result-actions">
            <button className="secondary-button" aria-expanded={preview===item.group.id} onClick={()=>setPreview(prev=>prev===item.group.id?null:item.group.id)}>{preview===item.group.id?"Ocultar precios":"Comparar aquí"}</button>
            <button className="primary-button" onClick={()=>onSelect(item.group)}>Ver detalles →</button>
          </div>
        </div>
        {result&&<div className="smart-inline-comparison">
          <p>Coste efectivo de una unidad. Solo se muestran costes verificables; artículos distintos se comparan por separado.</p>
          <div className="table-wrap"><table><thead><tr><th>Proveedor</th><th>Precio publicado</th><th>Coste efectivo</th><th>Estado</th></tr></thead>
          <tbody>{result.matches.map((m,index)=><tr key={m.offer.supplierId+"-"+(m.offer.supplierSku??index)}>
            <td>{m.offer.supplierId}</td><td>{(m.offer.salePrice??m.offer.regularPrice).toFixed(2)} €</td>
            <td>{m.eligibleForRanking&&m.pricing?m.pricing.effectiveTotalCost.toFixed(2)+" €":"—"}</td>
            <td>{m.eligibleForRanking?"Verificada y comparable":"No comparable todavía"}</td>
          </tr>)}</tbody></table></div>
        </div>}
      </div>;
    })}</div>}
  </section>;
}
