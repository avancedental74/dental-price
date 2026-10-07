import type { MatchedSupplierOffer } from "../domain/comparison/types";
import { getFreshnessStatus } from "../domain/comparison/compare";
const names:Record<string,string>={"dentaltix":"Dentaltix","proclinic":"Proclinic","dental-iberica":"Dental Ibérica"};

function eligibilityLabel(item:MatchedSupplierOffer):string{
  if(item.eligibleForRanking) return "Comparable";
  if(item.offer.sourceStatus==="quarantined") return "Precio en cuarentena";
  if(item.offer.sourceStatus==="suspicious") return "Precio sospechoso";
  if(item.offer.stockStatus==="unavailable") return "Sin stock";
  if(item.offer.stockStatus==="backorder") return "Bajo pedido";
  if(item.offer.stockStatus==="preorder") return "Preventa";
  if(item.offer.stockStatus==="unknown") return "Stock no confirmado";
  if(getFreshnessStatus(item.offer)==="stale") return "Dato antiguo";
  if(item.match.status!=="EXACT") return item.match.status;
  const warnings=item.pricing?.warnings ?? [];
  if(warnings.some(w=>w.includes("IVA"))) return "IVA no confirmado";
  if(warnings.some(w=>w.includes("Transporte"))) return "Portes no confirmados";
  return "No elegible";
}

export function ComparisonTable({items}:{items:MatchedSupplierOffer[]}){
  return <section className="card"><div className="section-head"><div><p className="eyebrow">COMPARATIVA</p><h3>Proveedores</h3></div><span>{items.length} resultados</span></div>
    <div className="table-wrap"><table><thead><tr><th>Proveedor</th><th>Precio</th><th>Coste efectivo</th><th>Stock</th><th>Estado</th></tr></thead>
      <tbody>{items.map((item,index)=><tr key={`${item.offer.supplierId}-${item.offer.supplierSku ?? item.offer.manufacturerReference ?? index}`}>
        <td><strong>{names[item.offer.supplierId] ?? item.offer.supplierId}</strong></td>
        <td>{(item.offer.salePrice ?? item.offer.regularPrice).toFixed(2)} €</td>
        <td>{item.pricing ? `${item.pricing.effectiveTotalCost.toFixed(2)} €` : "—"}</td>
        <td>{item.offer.stockStatus==="in_stock"?"Disponible":item.offer.stockStatus==="low_stock"?"Pocas unidades":item.offer.stockStatus}</td>
        <td><span className={item.eligibleForRanking?"pill good":"pill"}>{eligibilityLabel(item)}</span></td>
      </tr>)}</tbody></table></div>
  </section>;
}