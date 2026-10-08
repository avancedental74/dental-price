import {useMemo,useState} from "react";
import type {MatchedSupplierOffer} from "../domain/comparison/types";
import {getFreshnessStatus} from "../domain/comparison/compare";

const names:Record<string,string>={
  dentaltix:"Dentaltix",proclinic:"Proclinic","dental-iberica":"Dental Iberica",
  dentalcost:"DentalCost","dvd-dental":"DVD Dental",dentalexpress:"Dental Express",
  brokerdental:"Broker Dental",ortolan:"Ortolan Dental",dentipak:"Dentipak",dentalboom:"Dental Boom"
};

function eligibilityLabel(item:MatchedSupplierOffer):string{
  if(item.eligibleForRanking) return "Live - comparable";
  if(item.offer.priceVerification==="search_index") return "Precio de buscador no confirmado";
  if(item.offer.verificationKind==="snapshot") return "Snapshot historico";
  if(item.offer.verificationKind==="manual") return "Manual - fuera de sesion live";
  if(item.offer.sourceStatus==="quarantined") return "Precio en cuarentena";
  if(item.offer.sourceStatus==="suspicious") return "Precio sospechoso";
  if(item.offer.stockStatus==="unavailable") return "Sin stock";
  if(item.offer.stockStatus==="backorder") return "Bajo pedido";
  if(item.offer.stockStatus==="preorder") return "Preventa";
  if(item.offer.stockStatus==="unknown") return "Stock no confirmado";
  if(getFreshnessStatus(item.offer)==="stale") return "Dato antiguo";
  if(item.match.status!=="EXACT") return item.match.status;
  if(item.offer.sourceMode==="automatic" && (!item.offer.shippingPolicyObservedAt || (Date.now()-new Date(item.offer.shippingPolicyObservedAt).getTime())/86400000>30)) return "Portes sin revalidar";
  const warnings=item.pricing?.warnings ?? [];
  if(warnings.some(w=>w.includes("IVA"))) return "IVA no confirmado";
  if(warnings.some(w=>w.includes("Transporte"))) return "Portes no confirmados";
  return item.offer.verificationKind==="live"?"Live - no elegible":"No elegible";
}

export type ComparisonSortKey="reliability"|"supplier"|"publishedPrice"|"effectiveTotal"|"availability";

function publishedPrice(item:MatchedSupplierOffer):number{
  const value=item.offer.salePrice ?? item.offer.regularPrice;
  return Number.isFinite(value)&&value>0?value:Infinity;
}

function availabilityRank(item:MatchedSupplierOffer):number{
  if(item.offer.stockStatus==="in_stock")return 0;
  if(item.offer.stockStatus==="low_stock")return 1;
  if(item.offer.stockStatus==="backorder")return 2;
  if(item.offer.stockStatus==="preorder")return 3;
  if(item.offer.stockStatus==="unknown")return 4;
  return 5;
}

function reliabilityRank(item:MatchedSupplierOffer):number{
  if(item.eligibleForRanking)return 0;
  if(item.offer.priceVerification==="detail"&&item.match.status==="EXACT")return 1;
  if(item.offer.priceVerification==="search_index")return 3;
  return 2;
}

export function sortComparisonItems(items:MatchedSupplierOffer[],key:ComparisonSortKey):MatchedSupplierOffer[]{
  return [...items].sort((a,b)=>{
    if(key==="supplier")return (names[a.offer.supplierId]??a.offer.supplierId).localeCompare(names[b.offer.supplierId]??b.offer.supplierId,"es");
    if(key==="publishedPrice")return publishedPrice(a)-publishedPrice(b)||reliabilityRank(a)-reliabilityRank(b);
    if(key==="effectiveTotal")return (a.pricing?.effectiveTotalCost??Infinity)-(b.pricing?.effectiveTotalCost??Infinity)||reliabilityRank(a)-reliabilityRank(b);
    if(key==="availability")return availabilityRank(a)-availabilityRank(b)||reliabilityRank(a)-reliabilityRank(b);
    return reliabilityRank(a)-reliabilityRank(b)||Number(b.offer.verificationKind==="live")-Number(a.offer.verificationKind==="live");
  });
}

function euro(value:number):string{
  return value.toFixed(2)+" EUR";
}

export function ComparisonTable({items}:{items:MatchedSupplierOffer[]}){
  const [sortKey,setSortKey]=useState<ComparisonSortKey>("reliability");
  const sorted=useMemo(()=>sortComparisonItems(items,sortKey),[items,sortKey]);
  const sortOptions:Array<{key:ComparisonSortKey;label:string}>=[
    {key:"reliability",label:"Fiabilidad"},
    {key:"effectiveTotal",label:"Coste total"},
    {key:"publishedPrice",label:"Precio"},
    {key:"supplier",label:"Proveedor"},
    {key:"availability",label:"Disponibilidad"}
  ];
  return <section className="card">
    <div className="section-head"><div><p className="eyebrow">COMPARATIVA</p><h3>Proveedores consultados</h3></div><span>{items.length} resultados</span></div>
    <div className="comparison-sort" role="group" aria-label="Ordenar comparativa">
      {sortOptions.map(option=><button key={option.key} type="button" className={sortKey===option.key?"active":""} aria-pressed={sortKey===option.key} onClick={()=>setSortKey(option.key)}>{option.label}</button>)}
    </div>
    <div className="table-wrap"><table><thead><tr><th>Proveedor</th><th>Precio</th><th>Coste efectivo</th><th>Stock</th><th>Verificacion</th><th>Estado</th></tr></thead>
      <tbody>{sorted.map((item,index)=><tr key={`${item.offer.supplierId}-${item.offer.verificationKind??"legacy"}-${item.offer.supplierSku ?? item.offer.manufacturerReference ?? index}`}>
        <td><strong>{names[item.offer.supplierId] ?? item.offer.supplierId}</strong></td>
        <td>{publishedPrice(item)!==Infinity?euro(publishedPrice(item)):"-"}{item.offer.priceVerification==="search_index"&&<small className="source-note">Precio orientativo del indice, verificar en la ficha</small>}<small className="source-note">{item.offer.vatStatus==="included"?"IVA incluido":item.offer.vatStatus==="excluded"?"Sin IVA":"IVA pendiente"}</small></td>
        <td>{item.offer.priceVerification==="search_index"?"-":item.pricing ? euro(item.pricing.effectiveTotalCost) : "-"}</td>
        <td>{item.offer.stockStatus==="in_stock"?"Disponible":item.offer.stockStatus==="low_stock"?"Pocas unidades":item.offer.stockStatus}</td>
        <td>{item.offer.priceVerification==="search_index"?<><b>Nivel C</b><small className="source-note">Precio no contrastado en ficha</small></>:item.offer.verificationKind==="live" ? <><b>{item.eligibleForRanking?"Nivel A":"Nivel B"}</b><small className="source-note">{item.offer.verifiedAt?new Date(item.offer.verifiedAt).toLocaleTimeString("es-ES"):"sesion live"}</small></> : <><span>Snapshot</span><small className="source-note">{new Date(item.offer.observedAt).toLocaleString("es-ES")}</small></>}</td>
        <td><span className={item.eligibleForRanking?"pill good":"pill"}>{eligibilityLabel(item)}</span></td>
      </tr>)}</tbody></table></div>
  </section>;
}
