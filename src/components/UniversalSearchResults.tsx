import {useMemo,useState} from "react";
import type {LiveSearchGroup,SearchDepth} from "../services/live-prices";
import {
  assessProducts,assessAlternatives,filterProducts,getAvailableFacets,
  profileForSearch,profileLabel,facetLabels,
  type SearchFilters,type SearchFacet,type UniversalOffer
} from "../features/search/universal";

const money=(v:number)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(v);
const supplierNames:Record<string,string>={
  dentaltix:"Dentaltix",dentalcost:"DentalCost","dvd-dental":"DVD Dental",
  dentalexpress:"Dental Express",ortolan:"Ortolan",dentipak:"Dentipak",
  dentalboom:"Dental Boom",proclinic:"Proclinic","dental-iberica":"Dental Ibérica",
  brokerdental:"Broker Dental"
};
function SupplierRows({offers}: {offers:UniversalOffer[]}){
  return <div className="table-wrap"><table className="universal-offers-table"><thead><tr>
    <th>Depósito</th><th>Precio publicado</th><th>Coste efectivo</th><th>Estado</th><th>Ficha</th>
  </tr></thead><tbody>{offers.map(o=><tr key={o.id}>
    <td><strong>{supplierNames[o.supplierId]??o.supplierId}</strong></td>
    <td>{Number.isFinite(o.publishedPrice)?money(o.publishedPrice):"—"}</td>
    <td>{o.effectiveTotal===undefined?"—":money(o.effectiveTotal)}</td>
    <td>{o.eligible?<span className="pill good">Verificado</span>:<small>{o.issues.join("; ")||"Pendiente de verificación"}</small>}</td>
    <td>{o.productUrl?<a href={o.productUrl} target="_blank" rel="noopener noreferrer">Abrir ↗</a>:<span>Sin enlace verificado</span>}</td>
  </tr>)}</tbody></table></div>;
}
export function UniversalSearchResults({items,query,onSelect,sessionId,searchDepth,coverage,onExpand}:{
  items:LiveSearchGroup[];query:string;sessionId:string|null;onSelect:(group:LiveSearchGroup)=>void;
  searchDepth:SearchDepth;coverage:Array<{supplierId:string;offers:number;candidateLimitReached:boolean;queries:number;partialErrors:number}>;onExpand:()=>void;
}){
  const [filters,setFilters]=useState<SearchFilters>({});
  const [mode,setMode]=useState<"offers"|"alternatives">("offers");
  const [opened,setOpened]=useState<string|null>(null);
  const [category,setCategory]=useState<string|null>(null);
  const products=useMemo(()=>assessProducts(items,sessionId),[items,sessionId]);
  const profile=useMemo(()=>profileForSearch(query,items),[query,items]);
  const facets=useMemo(()=>getAvailableFacets(products),[products]);
  // Data-driven grouping works for any product family. It uses the best covered
  // attribute, not a hard-coded "gloves" branch.
  const groupFacet=useMemo(()=>{
    const choices=["material","manufacturer","presentation","shade","variant"] as SearchFacet[];
    return choices.map(key=>facets.find(f=>f.key===key))
      .find(f=>f&&f.values.length>=2&&f.values.length<=8) ?? null;
  },[facets]);
  const categoryValues=groupFacet?.values??[];
  const scoped=useMemo(()=>filterProducts(products,category&&groupFacet?{[groupFacet.key]:category}:{}),[products,category,groupFacet]);
  const facetOptions=useMemo(()=>getAvailableFacets(scoped),[scoped]);
  const visible=useMemo(()=>filterProducts(scoped,filters),[scoped,filters]);
  const alternatives=useMemo(()=>assessAlternatives(visible,filters,profile),[visible,filters,profile]);
  const sorted=useMemo(()=>[...visible].sort((a,b)=>
    (a.best?.effectiveTotal??Infinity)-(b.best?.effectiveTotal??Infinity)),[visible]);
  if(!items.length)return null;
  const change=(key:SearchFacet,value:string)=>setFilters(old=>({...old,[key]:old[key]===value?undefined:value}));
  const clear=()=>{setCategory(null);setFilters({});setOpened(null);};
  return <section className="card smart-search universal-results">
    <div className="section-head">
      <div><p className="eyebrow">COMPARADOR UNIVERSAL · BÚSQUEDA EN VIVO</p>
        <h3>{profileLabel(profile)}: opciones encontradas</h3></div>
      <span>{visible.length} de {items.length} productos</span>
    </div>
    <p className="universal-intro">Consulta cualquier referencia o nombre. Cada producto se compara con sus propios proveedores; otras marcas aparecen por separado.</p>
    <div className="universal-coverage">
      <div><strong>Alcance real de la búsqueda</strong>
        <small>{coverage.filter(c=>c.offers>0).length} de {coverage.length} proveedores automáticos devolvieron productos · {coverage.filter(c=>c.candidateLimitReached).length} alcanzaron su límite de revisión de candidatos.</small>
        <small>{coverage.reduce((n,c)=>n+c.queries,0)} consultas enviadas; {coverage.reduce((n,c)=>n+c.partialErrors,0)} consultas con errores parciales. La cobertura no equivale a todo el catálogo.</small>
        {searchDepth==="extended"&&<small>Consulta ampliada aplicada. Algunas webs pueden restringir la cantidad de resultados o requerir verificación.</small>}
      </div>
      {searchDepth==="standard"&&<button type="button" className="secondary-button" onClick={onExpand}>Ampliar resultados ↗</button>}
    </div>
    <details className="universal-protected-suppliers">
      <summary>Otros 3 depósitos requieren acceso desde su web</summary>
      <p>Estas búsquedas se abren en el sitio del proveedor. Sus precios no se incorporan automáticamente ni se consideran verificados en Dental Price.</p>
      <div className="universal-protected-links">
        <a href={"https://www.proclinic.es/tienda/catalogsearch/result/?q="+encodeURIComponent(query)} target="_blank" rel="noopener noreferrer">Buscar en Proclinic ↗</a>
        <a href={"https://dentaliberica.com/?s="+encodeURIComponent(query)+"&post_type=product"} target="_blank" rel="noopener noreferrer">Buscar en Dental Ibérica ↗</a>
        <a href={"https://www.brokerdental.es/catalogsearch/result/?q="+encodeURIComponent(query)} target="_blank" rel="noopener noreferrer">Buscar en Broker Dental ↗</a>
      </div>
    </details>
    <div className="smart-mode-toggle" role="group" aria-label="Tipo de comparación">
      <button type="button" aria-pressed={mode==="offers"} className={mode==="offers"?"active":""} onClick={()=>setMode("offers")}>Ofertas por producto</button>
      <button type="button" aria-pressed={mode==="alternatives"} className={mode==="alternatives"?"active":""} onClick={()=>setMode("alternatives")}>Explorar alternativas</button>
    </div>
    {categoryValues.length>0&&<div className="smart-categories" aria-label={"Agrupar por "+facetLabels[groupFacet!.key]}>
      <button type="button" className={!category?"active":""} onClick={()=>setCategory(null)}>Todos <small>{products.length} productos</small></button>
      {categoryValues.map(entry=><button type="button" key={entry.value} className={category===entry.value?"active":""}
        onClick={()=>{setCategory(entry.value);setFilters(old=>({...old,[groupFacet!.key]:undefined}));}}>
        <strong>{entry.value}</strong><small>{entry.count} productos</small>
      </button>)}
    </div>}
    {facetOptions.length>0&&<div className="universal-filter-panel">
      <div className="smart-filter-header"><strong>Filtrar por características reales</strong>
        <button type="button" onClick={clear}>Limpiar filtros</button>
      </div>
      <div className="smart-facets">{facetOptions.map(f=><fieldset key={f.key}>
        <legend>{facetLabels[f.key]}</legend>
        <div className="smart-chips"><button type="button" className={!filters[f.key]?"active":""} onClick={()=>setFilters(old=>({...old,[f.key]:undefined}))}>Todos</button>
          {f.values.map(v=><button type="button" key={v.value} className={filters[f.key]===v.value?"active":""}
            onClick={()=>change(f.key,v.value)}>{v.value} <small>({v.count})</small></button>)}
        </div>
      </fieldset>)}</div>
    </div>}
    {mode==="offers"?<div className="universal-product-list">
      <div className="smart-direct-head"><strong>Resultados con precios por referencia</strong>
        <p>Ordenados por el menor coste total verificable dentro de cada artículo. Un precio bajo en un producto distinto no lo convierte en alternativa equivalente.</p></div>
      {sorted.length===0?<p className="smart-no-results">Ningún artículo cumple esos filtros. Prueba a ampliarlos.</p>:
        sorted.map(product=><div key={product.group.id} className="universal-product-card">
          <div className="universal-product-main">
            <div className="universal-product-title">
              <strong>{product.group.label}</strong>
              <small>{[
                product.group.manufacturerReference?"Ref. "+product.group.manufacturerReference:null,
                new Set(product.group.offers.map(o=>o.supplierId)).size+" proveedor(es)",
                product.specs.properties.quantity,
                product.specs.properties.shade,
                product.specs.properties.presentation
              ].filter(Boolean).join(" · ")}</small>
            </div>
            <div className="universal-product-price">
              {product.best?.effectiveTotal!==undefined
                ?<><strong>{money(product.best.effectiveTotal)}</strong><small>Mejor coste verificado de este producto</small></>
                :<><strong>Por verificar</strong><small>Precio, stock o portes incompletos</small></>}
            </div>
            <div className="smart-result-actions">
              <button type="button" className="secondary-button" aria-expanded={opened===product.group.id}
                onClick={()=>setOpened(old=>old===product.group.id?null:product.group.id)}>{opened===product.group.id?"Ocultar proveedores":"Ver proveedores"}</button>
              <button type="button" className="primary-button" onClick={()=>onSelect(product.group)}>Ficha y compra →</button>
            </div>
          </div>
          {opened===product.group.id&&<SupplierRows offers={[...product.offers].sort((a,b)=>(a.effectiveTotal??Infinity)-(b.effectiveTotal??Infinity))}/>}
        </div>)}
    </div>:<div className="alternatives-section">
      <div className="smart-direct-head"><strong>Opciones de otras marcas o presentaciones</strong>
        <p>Se muestran productos que satisfacen los filtros. El sistema solo ordena conjuntamente artículos cuando puede justificar su comparabilidad.</p></div>
      {alternatives.reason&&<div className="alternatives-hint"><strong>Comparación por características, pendiente de validar.</strong><p>{alternatives.reason}</p></div>}
      {alternatives.ranked.length>0&&<>
        <p className="alternatives-count">{alternatives.ranked.length} ofertas comparables con el mismo criterio</p>
        <div className="table-wrap"><table className="universal-offers-table"><thead><tr>
          <th>Producto</th><th>Depósito</th><th>Envase</th><th>Coste total</th><th>Coste normalizado</th><th>Ver</th>
        </tr></thead><tbody>{alternatives.ranked.map(o=><tr key={o.id}>
          <td><strong>{o.name}</strong></td>
          <td>{supplierNames[o.supplierId]??o.supplierId}</td>
          <td>{o.count} {o.unit==="unit"?"uds.":o.unit}</td>
          <td>{o.effectiveTotal===undefined?"—":money(o.effectiveTotal)}</td>
          <td><strong>{o.normalizedCost===undefined?"—":money(o.normalizedCost)}</strong> <small>{o.normalizedBasis}</small></td>
          <td>{o.productUrl?<a href={o.productUrl} target="_blank" rel="noopener noreferrer">Proveedor ↗</a>:"—"}</td>
        </tr>)}</tbody></table></div>
      </>}
      {alternatives.unverified.length>0&&<details className="alternatives-pending" open={alternatives.ranked.length===0}>
        <summary>{alternatives.unverified.length} opciones sin ranking de equivalencia</summary>
        <div className="alternatives-pending-list">
          {alternatives.unverified.map(o=><div key={o.id}><strong>{o.name}</strong>
            <small>{supplierNames[o.supplierId]??o.supplierId} · Precio publicado: {Number.isFinite(o.publishedPrice)?money(o.publishedPrice):"No disponible"} · Coste verificable de su envase: {o.effectiveTotal===undefined?"Pendiente":money(o.effectiveTotal)}</small>
            {o.normalizedCost!==undefined&&<small>Coste orientativo por {o.normalizedBasis}: {money(o.normalizedCost)} (no acredita equivalencia con otros productos)</small>}
            <small>{[
              ...o.issues,
              alternatives.reason??"Sin homologación de características entre marcas"
            ].join("; ")}</small>
            {o.productUrl&&<a href={o.productUrl} target="_blank" rel="noopener noreferrer">Consultar producto ↗</a>}
          </div>)}
        </div>
      </details>}
      {!alternatives.ranked.length&&!alternatives.unverified.length&&<p className="smart-no-results">No se encontraron alternativas con los filtros elegidos.</p>}
      <p className="alternatives-footnote">Los costes normalizados provienen del coste de un envase verificado, con IVA y transporte cuando están confirmados. No equivalen al coste exacto de comprar una cantidad fija. La búsqueda puede tener proveedores no disponibles.</p>
    </div>}
  </section>;
}
