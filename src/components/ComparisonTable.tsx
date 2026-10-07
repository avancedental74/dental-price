import type { MatchedSupplierOffer } from "../domain/comparison/types";
const names:Record<string,string>={"dentaltix":"Dentaltix","proclinic":"Proclinic","dental-iberica":"Dental Ibérica"};

export function ComparisonTable({items}:{items:MatchedSupplierOffer[]}){
  return <section className="card"><div className="section-head"><div><p className="eyebrow">COMPARATIVA</p><h3>Proveedores</h3></div><span>{items.length} resultados</span></div>
    <div className="table-wrap"><table><thead><tr><th>Proveedor</th><th>Precio</th><th>Coste efectivo</th><th>Stock</th><th>Estado</th></tr></thead>
      <tbody>{items.map(item=><tr key={item.offer.supplierId}>
        <td><strong>{names[item.offer.supplierId] ?? item.offer.supplierId}</strong></td>
        <td>{(item.offer.salePrice ?? item.offer.regularPrice).toFixed(2)} €</td>
        <td>{item.pricing ? `${item.pricing.effectiveTotalCost.toFixed(2)} €` : "—"}</td>
        <td>{item.offer.stockStatus==="in_stock"?"Disponible":item.offer.stockStatus}</td>
        <td><span className={item.eligibleForRanking?"pill good":"pill"}>{item.eligibleForRanking?"Comparable":item.match.status}</span></td>
      </tr>)}</tbody></table></div>
  </section>;
}