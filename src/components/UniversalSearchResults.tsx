import {useMemo,useState} from "react";
import type {LiveSearchGroup,SearchDepth} from "../services/live-prices";
import {classifyPurchaseIntent} from "../features/search/purchase-intent";
import {collectPublishedPrices} from "../features/search/published-prices";
import {AllSupplierPrices} from "./AllSupplierPrices";
import {
  assessAlternatives,assessProducts,facetLabels,filterProducts,getAvailableFacets,
  profileForSearch,profileLabel,
  type SearchFacet,type SearchFilters,type UniversalOffer
} from "../features/search/universal";

const money=(value:number)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(value);
const supplierNames:Record<string,string>={
  dentaltix:"Dentaltix",dentalcost:"DentalCost","dvd-dental":"DVD Dental",
  dentalexpress:"Dental Express",ortolan:"Ortolan",dentipak:"Dentipak",
  dentalboom:"Dental Boom",proclinic:"Proclinic","dental-iberica":"Dental Iberica",
  brokerdental:"Broker Dental"
};
const identityLabels={
  exact_identity:"Misma referencia acreditada",
  probable_identity:"Coincidencia probable",
  insufficient_identity:"Identidad insuficiente"
};

function SupplierRows({offers}:{offers:UniversalOffer[]}){
  return <div className="table-wrap supplier-inline-table"><table className="universal-offers-table"><thead><tr>
    <th>Deposito</th><th>Precio publicado</th><th>Coste y unidad</th><th>Fiabilidad</th><th>Ficha</th>
  </tr></thead><tbody>{offers.map(offer=><tr key={offer.id}>
    <td><strong>{supplierNames[offer.supplierId]??offer.supplierId}</strong></td>
    <td>{Number.isFinite(offer.publishedPrice)&&offer.publishedPrice>0?money(offer.publishedPrice):"-"}
      <small className="source-note">{offer.vatStatus==="excluded"?"Sin IVA":offer.vatStatus==="included"?"IVA incluido":"IVA por confirmar"}</small></td>
    <td>{offer.effectiveTotal===undefined?"-":money(offer.effectiveTotal)}
      {offer.normalizedCost!==undefined&&<small className="source-note">{money(offer.normalizedCost)} / {offer.normalizedBasis}</small>}</td>
    <td><span className={offer.verificationLevel==="A"?"pill good":"pill"}>Nivel {offer.verificationLevel}</span>
      {!offer.eligible&&<small>{offer.issues.join("; ")||"Pendiente de verificacion"}</small>}</td>
    <td>{offer.productUrl?<a href={offer.productUrl} target="_blank" rel="noopener noreferrer">Abrir</a>:<span>Sin enlace verificado</span>}</td>
  </tr>)}</tbody></table></div>;
}

export function UniversalSearchResults({items,query,onSelect,sessionId,searchDepth,coverage,onExpand}:{
  items:LiveSearchGroup[];query:string;sessionId:string|null;onSelect:(group:LiveSearchGroup)=>void;
  searchDepth:SearchDepth;coverage:Array<{supplierId:string;offers:number;candidateLimitReached:boolean;queries:number;partialErrors:number;status:"results"|"no_match"|"error"}>;onExpand:()=>void;
}){
  const [filters,setFilters]=useState<SearchFilters>({});
  const [mode,setMode]=useState<"offers"|"alternatives">("offers");
  const [category,setCategory]=useState<string|null>(null);
  const products=useMemo(()=>assessProducts(items,sessionId),[items,sessionId]);
  const requestedProducts=useMemo(()=>products.filter(product=>classifyPurchaseIntent(query,product.group.label)==="requested_product"),[products,query]);
  const relatedProducts=useMemo(()=>products.filter(product=>classifyPurchaseIntent(query,product.group.label)==="related_accessory"),[products,query]);
  const profile=useMemo(()=>profileForSearch(query,items),[query,items]);
  const facets=useMemo(()=>getAvailableFacets(requestedProducts),[requestedProducts]);
  const groupFacet=useMemo(()=>{
    const choices=["material","manufacturer","presentation","shade","variant"] as SearchFacet[];
    return choices.map(key=>facets.find(facet=>facet.key===key))
      .find(facet=>facet&&facet.values.length>=2&&facet.values.length<=8) ?? null;
  },[facets]);
  const categoryValues=groupFacet?.values??[];
  const scoped=useMemo(()=>filterProducts(requestedProducts,category&&groupFacet?{[groupFacet.key]:category}:{}),[requestedProducts,category,groupFacet]);
  const facetOptions=useMemo(()=>getAvailableFacets(scoped),[scoped]);
  const visible=useMemo(()=>filterProducts(scoped,filters),[scoped,filters]);
  const publishedPriceRows=useMemo(()=>collectPublishedPrices(products,{}),[products]);
  const alternatives=useMemo(()=>assessAlternatives(visible,filters,profile),[visible,filters,profile]);
  const sorted=useMemo(()=>[...visible].sort((a,b)=>(a.best?.effectiveTotal??Infinity)-(b.best?.effectiveTotal??Infinity)),[visible]);
  if(!items.length)return null;
  const change=(key:SearchFacet,value:string)=>setFilters(old=>({...old,[key]:old[key]===value?undefined:value}));
  const clear=()=>{setCategory(null);setFilters({});};
  return <section className="card smart-search universal-results">
    <div className="section-head">
      <div><p className="eyebrow">COMPARADOR UNIVERSAL - BUSQUEDA EN VIVO</p><h3>{profileLabel(profile)}: opciones encontradas</h3></div>
      <span>{visible.length} productos principales - {relatedProducts.length} relacionados</span>
    </div>
    <p className="universal-intro">Cada producto muestra sus proveedores inmediatamente. Los precios Nivel C se conservan para descubrimiento, pero no compiten como recomendacion de compra.</p>
    <div className="universal-coverage">
      <div><strong>Alcance real de la busqueda</strong>
        <small>{coverage.filter(c=>c.offers>0).length} de {coverage.length} proveedores automaticos devolvieron productos - {coverage.filter(c=>c.candidateLimitReached).length} alcanzaron limite de candidatos.</small>
        <small>{coverage.reduce((n,c)=>n+c.queries,0)} consultas enviadas; {coverage.reduce((n,c)=>n+c.partialErrors,0)} consultas con errores parciales. La cobertura no equivale a todo el catalogo.</small>
        {searchDepth==="extended"&&<small>Consulta ampliada aplicada. Algunas webs pueden restringir resultados o requerir verificacion.</small>}
      </div>
      {searchDepth==="standard"&&<button type="button" className="secondary-button" onClick={onExpand}>Ampliar resultados</button>}
    </div>
    <details className="universal-protected-suppliers">
      <summary>Estado de los {coverage.length} depositos automaticos</summary>
      <div className="provider-status-list">{coverage.map(item=><div key={item.supplierId}>
        <strong>{supplierNames[item.supplierId]??item.supplierId}</strong>
        <span>{item.status==="results"?item.offers+" ofertas recuperadas":item.status==="error"?"Consulta fallida":"Sin coincidencias recuperadas"} - {item.queries} intento(s){item.partialErrors>0?" - "+item.partialErrors+" error(es)":""}</span>
      </div>)}</div>
    </details>
    <details className="universal-protected-suppliers">
      <summary>Otros 3 depositos requieren acceso desde su web</summary>
      <p>Estas busquedas se abren en el sitio del proveedor. Sus precios no se incorporan automaticamente ni se consideran verificados en Dental Price.</p>
      <div className="universal-protected-links">
        <a href={"https://www.proclinic.es/tienda/catalogsearch/result/?q="+encodeURIComponent(query)} target="_blank" rel="noopener noreferrer">Buscar en Proclinic</a>
        <a href={"https://dentaliberica.com/?s="+encodeURIComponent(query)+"&post_type=product"} target="_blank" rel="noopener noreferrer">Buscar en Dental Iberica</a>
        <a href={"https://www.brokerdental.es/catalogsearch/result/?q="+encodeURIComponent(query)} target="_blank" rel="noopener noreferrer">Buscar en Broker Dental</a>
      </div>
    </details>
    <AllSupplierPrices rows={publishedPriceRows}/>
    <div className="smart-mode-toggle" role="group" aria-label="Tipo de comparacion">
      <button type="button" aria-pressed={mode==="offers"} className={mode==="offers"?"active":""} onClick={()=>setMode("offers")}>Proveedores por producto</button>
      <button type="button" aria-pressed={mode==="alternatives"} className={mode==="alternatives"?"active":""} onClick={()=>setMode("alternatives")}>Alternativas</button>
    </div>
    {categoryValues.length>0&&<div className="smart-categories" aria-label={"Agrupar por "+facetLabels[groupFacet!.key]}>
      <button type="button" className={!category?"active":""} onClick={()=>setCategory(null)}>Todos <small>{requestedProducts.length} productos</small></button>
      {categoryValues.map(entry=><button type="button" key={entry.value} className={category===entry.value?"active":""}
        onClick={()=>{setCategory(entry.value);setFilters(old=>({...old,[groupFacet!.key]:undefined}));}}>
        <strong>{entry.value}</strong><small>{entry.count} productos</small>
      </button>)}
    </div>}
    {facetOptions.length>0&&<div className="universal-filter-panel">
      <div className="smart-filter-header"><strong>Filtrar por caracteristicas reales</strong><button type="button" onClick={clear}>Limpiar filtros</button></div>
      <div className="smart-facets">{facetOptions.map(facet=><fieldset key={facet.key}>
        <legend>{facetLabels[facet.key]}</legend>
        <div className="smart-chips"><button type="button" className={!filters[facet.key]?"active":""} onClick={()=>setFilters(old=>({...old,[facet.key]:undefined}))}>Todos</button>
          {facet.values.map(value=><button type="button" key={value.value} className={filters[facet.key]===value.value?"active":""}
            onClick={()=>change(facet.key,value.value)}>{value.value} <small>({value.count})</small></button>)}
        </div>
      </fieldset>)}</div>
    </div>}
    {mode==="offers"?<div className="universal-product-list">
      <div className="smart-direct-head"><strong>Productos y proveedores</strong><p>La primera vista ya muestra precios, coste unitario cuando es fiable y nivel de evidencia.</p></div>
      {sorted.length===0?<p className="smart-no-results">Ningun articulo cumple esos filtros. Prueba a ampliarlos.</p>:
        sorted.map(product=><div key={product.group.id} className="universal-product-card">
          <div className="universal-product-main">
            <div className="universal-product-title">
              <strong>{product.group.label}</strong>
              <small>{[
                product.group.manufacturerReference?"Ref. "+product.group.manufacturerReference:null,
                identityLabels[product.group.identityLevel],
                new Set(product.group.offers.map(offer=>offer.supplierId)).size+" proveedor(es)",
                product.specs.properties.quantity,
                product.specs.properties.shade,
                product.specs.properties.presentation
              ].filter(Boolean).join(" - ")}</small>
              {product.group.identityReasons.length>0&&<small className="identity-reasons">{product.group.identityReasons.join("; ")}</small>}
            </div>
            <div className="universal-product-price">
              {product.best?.effectiveTotal!==undefined
                ?<><strong>{money(product.best.effectiveTotal)}</strong><small>Mejor coste verificado de este producto</small></>
                :<><strong>Por verificar</strong><small>Precio, stock o portes incompletos</small></>}
            </div>
            <div className="smart-result-actions"><button type="button" className="primary-button" onClick={()=>onSelect(product.group)}>Ficha y cesta</button></div>
          </div>
          <SupplierRows offers={[...product.offers].sort((a,b)=>(a.effectiveTotal??Infinity)-(b.effectiveTotal??Infinity))}/>
        </div>)}
    </div>:<div className="alternatives-section">
      <div className="smart-direct-head"><strong>Opciones de otras marcas o presentaciones</strong><p>Se muestran productos que satisfacen los filtros. El sistema solo ordena conjuntamente articulos cuando puede justificar su comparabilidad.</p></div>
      {alternatives.reason&&<div className="alternatives-hint"><strong>Comparacion por caracteristicas, pendiente de validar.</strong><p>{alternatives.reason}</p></div>}
      {alternatives.ranked.length>0&&<SupplierRows offers={alternatives.ranked}/>}
      {alternatives.unverified.length>0&&<details className="alternatives-pending" open={alternatives.ranked.length===0}>
        <summary>{alternatives.unverified.length} opciones sin ranking de equivalencia</summary>
        <div className="alternatives-pending-list">{alternatives.unverified.map(offer=><div key={offer.id}>
          <strong>{offer.name}</strong><small>{supplierNames[offer.supplierId]??offer.supplierId} - Precio publicado: {Number.isFinite(offer.publishedPrice)&&offer.publishedPrice>0?money(offer.publishedPrice):"No disponible"} - Nivel {offer.verificationLevel}</small>
          <small>{[...offer.issues,alternatives.reason??"Sin homologacion de caracteristicas entre marcas"].join("; ")}</small>
          {offer.productUrl&&<a href={offer.productUrl} target="_blank" rel="noopener noreferrer">Consultar producto</a>}
        </div>)}</div>
      </details>}
      {!alternatives.ranked.length&&!alternatives.unverified.length&&<p className="smart-no-results">No se encontraron alternativas con los filtros elegidos.</p>}
    </div>}
    {relatedProducts.length>0&&<details className="alternatives-pending">
      <summary>{relatedProducts.length} accesorios y productos relacionados</summary>
      <div className="alternatives-pending-list">{relatedProducts.map(product=><div key={product.group.id}>
        <strong>{product.group.label}</strong><small>{new Set(product.group.offers.map(offer=>offer.supplierId)).size} deposito(s) - fuera de la comparacion principal.</small>
        <SupplierRows offers={[...product.offers].sort((a,b)=>(a.effectiveTotal??Infinity)-(b.effectiveTotal??Infinity))}/>
        <button className="secondary-button" type="button" onClick={()=>onSelect(product.group)}>Examinar por separado</button>
      </div>)}</div>
    </details>}
  </section>;
}
