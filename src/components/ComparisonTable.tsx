import type { MatchedSupplierOffer } from "../domain/comparison/types";
import { getFreshnessStatus } from "../domain/comparison/compare";
const names:Record<string,string>={
  "dentaltix":"Dentaltix","proclinic":"Proclinic","dental-iberica":"Dental Ibérica","dentalcost":"DentalCost","dvd-dental":"DVD Dental",
  "dentalexpress":"Dental Express","brokerdental":"Broker Dental","ortolan":"Ortolan Dental","dentipak":"Dentipak","dentalboom":"Dental Boom"
};

function eligibilityLabel(item:MatchedSupplierOffer):string{
  if(item.eligibleForRanking) return "Live · comparable";
  if(item.offer.priceVerification==="search_index") return "Precio de buscador no confirmado";
  if(item.offer.verificationKind==="snapshot") return "Snapshot histórico";
  if(item.offer.verificationKind==="manual") return "Manual · fuera de sesión live";
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
  return item.offer.verificationKind==="live"?"Live · no elegible":"No elegible";
}

export function ComparisonTable({items}:{items:MatchedSupplierOffer[]}){
  const sorted=[...items].sort((a,b)=>Number(b.offer.verificationKind==="live")-Number(a.offer.verificationKind==="live"));
  return <section className="card"><div className="section-head"><div><p className="eyebrow">COMPARATIVA</p><h3>Proveedores consultados</h3></div><span>{items.length} resultados</span></div>
    <div className="table-wrap"><table><thead><tr><th>Proveedor</th><th>Precio</th><th>Coste efectivo</th><th>Stock</th><th>Verificación</th><th>Estado</th></tr></thead>
      <tbody>{sorted.map((item,index)=><tr key={`${item.offer.supplierId}-${item.offer.verificationKind??"legacy"}-${item.offer.supplierSku ?? item.offer.manufacturerReference ?? index}`}>
        <td><strong>{names[item.offer.supplierId] ?? item.offer.supplierId}</strong></td>
        <td>{item.offer.priceVerification==="search_index"?"Por comprobar":(item.offer.salePrice ?? item.offer.regularPrice).toFixed(2)+" €"}</td>
        <td>{item.offer.priceVerification==="search_index"?"—":item.pricing ? `${item.pricing.effectiveTotalCost.toFixed(2)} €` : "—"}</td>
        <td>{item.offer.stockStatus==="in_stock"?"Disponible":item.offer.stockStatus==="low_stock"?"Pocas unidades":item.offer.stockStatus}</td>
        <td>{item.offer.verificationKind==="live" ? <><b>Ahora</b><small className="source-note">{item.offer.verifiedAt?new Date(item.offer.verifiedAt).toLocaleTimeString("es-ES"):"sesión live"}</small></> : <><span>Snapshot</span><small className="source-note">{new Date(item.offer.observedAt).toLocaleString("es-ES")}</small></>}</td>
        <td><span className={item.eligibleForRanking?"pill good":"pill"}>{eligibilityLabel(item)}</span></td>
      </tr>)}</tbody></table></div>
  </section>;
}