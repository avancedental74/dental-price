import type {SupplierCoverage} from "../services/search-outcome";
import {evaluateCatalogOutcome} from "../services/search-outcome";
import type {SearchDepth} from "../services/live-prices";
import {supplierLabels} from "../connectors/live-supplier-registry";
const readable=(id:string)=>supplierLabels[id as keyof typeof supplierLabels]??id;

export function ZeroResultDiagnostics({query,coverage,errors,depth,onRetry,onExpand}:{
  query:string;coverage:SupplierCoverage[];errors:Array<{supplierId:string;message:string}>;
  depth:SearchDepth;onRetry:()=>void;onExpand:()=>void;
}){
  const outcome=evaluateCatalogOutcome(0,coverage);
  const foundNone=outcome==="no_match";
  const heading=foundNone?"Sin coincidencias en los depósitos consultados":
    outcome==="all_failed"?"No se pudieron consultar los depósitos":
    outcome==="partial_failure"?"Búsqueda incompleta: algunos depósitos no han respondido":
    "No fue posible confirmar resultados de la consulta";
  const description=foundNone
    ?`No han aparecido productos para «${query}» en las respuestas recibidas. Esto no demuestra que los depósitos no los vendan.`
    :"La búsqueda no ha podido comprobar todas las fuentes. No confundimos un error de acceso con que el producto no exista.";
  return <section className="card zero-result-diagnostics" aria-live="polite">
    <div className="zero-result-heading"><span className="state-icon">!</span><div>
      <p className="eyebrow">ESTADO DE LA CONSULTA</p>
      <h2>{heading}</h2><p>{description}</p>
    </div></div>
    <div className="zero-result-actions">
      <button className="primary-button" type="button" onClick={onRetry}>Reintentar búsqueda</button>
      {depth==="standard"&&<button className="secondary-button" type="button" onClick={onExpand}>Ampliar búsqueda</button>}
    </div>
    <details open className="universal-protected-suppliers">
      <summary>Estado de los {coverage.length||7} depósitos automáticos</summary>
      {coverage.length>0?<div className="provider-status-list">{coverage.map(item=><div key={item.supplierId}>
        <strong>{readable(item.supplierId)}</strong>
        <span>{item.status==="results"?item.offers+" ofertas recuperadas":
          item.status==="no_match"?"Sin coincidencias verificables":"Consulta fallida"}
          {" · "+item.queries+" intento(s)"}
          {item.partialErrors>0?" · "+item.partialErrors+" error(es) parciales":""}
        </span>
      </div>)}</div>:<p>No hay información de los depósitos. Comprueba la conexión con el servicio de búsqueda.</p>}
      {errors.length>0&&<div className="zero-result-errors">{errors.map((error,i)=>
        <small key={error.supplierId+"-"+i}>{readable(error.supplierId)}: {error.message}</small>)}</div>}
    </details>
    <details className="universal-protected-suppliers">
      <summary>Consultar en los tres depósitos con acceso protegido</summary>
      <p>Estos depósitos requieren navegación directa. Sus importes no han sido recuperados por el comparador.</p>
      <div className="universal-protected-links">
        <a target="_blank" rel="noopener noreferrer" href={"https://www.proclinic.es/tienda/catalogsearch/result/?q="+encodeURIComponent(query)}>Proclinic ↗</a>
        <a target="_blank" rel="noopener noreferrer" href={"https://dentaliberica.com/?s="+encodeURIComponent(query)+"&post_type=product"}>Dental Ibérica ↗</a>
        <a target="_blank" rel="noopener noreferrer" href={"https://www.brokerdental.es/catalogsearch/result/?q="+encodeURIComponent(query)}>Broker Dental ↗</a>
      </div>
    </details>
  </section>;
}
