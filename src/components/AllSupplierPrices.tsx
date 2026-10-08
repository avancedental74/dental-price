import type {PublishedPriceRow} from "../features/search/published-prices";
import {advertisedPriceLabel,hasAdvertisedPrice} from "../features/search/published-prices";
import {supplierLabels} from "../connectors/live-supplier-registry";
const euro=(value:number)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(value);
const supplierName=(id:string)=>supplierLabels[id as keyof typeof supplierLabels]??id;
const vatLabel=(value?:string)=>value==="included"?"IVA incluido":value==="excluded"?"Sin IVA":"IVA pendiente";

export function AllSupplierPrices({rows}:{rows:PublishedPriceRow[]}){
  const suppliers=new Set(rows.map(row=>row.offer.supplierId)).size;
  return <section className="all-supplier-prices" aria-label="Todos los precios recuperados">
    <div className="all-supplier-prices-heading">
      <div>
        <h4>Todos los precios encontrados</h4>
        <p><strong>{rows.length} ofertas</strong> de <strong>{suppliers} depósitos</strong>. Se muestran también los precios orientativos que no cumplen los requisitos para recomendar una compra.</p>
      </div>
    </div>
    {!rows.length?<p className="smart-no-results">Esta búsqueda no ha recuperado ningún importe para las características seleccionadas. Revisa el estado de los depósitos o amplía resultados.</p>:
    <div className="table-wrap">
      <table className="universal-offers-table all-supplier-prices-table">
        <thead><tr>
          <th>Producto y referencia</th><th>Depósito</th><th>Precio encontrado</th><th>Coste final</th><th>Origen y fiabilidad</th><th>Enlace</th>
        </tr></thead>
        <tbody>{rows.map(row=>{
          const offer=row.offer;
          return <tr key={row.id}>
            <td><strong>{row.productName}</strong>
              {offer.reference&&<small className="source-note">Ref.: {offer.reference}</small>}
            </td>
            <td><strong>{supplierName(offer.supplierId)}</strong></td>
            <td>{hasAdvertisedPrice(offer)?<strong>{euro(offer.publishedPrice)}</strong>:"Sin importe"}
              <small className="source-note">{vatLabel(offer.vatStatus)}</small>
            </td>
            <td>{offer.eligible&&offer.effectiveTotal!==undefined?<strong>{euro(offer.effectiveTotal)}</strong>:"No calculable"}
              <small className="source-note">IVA y portes solo si están acreditados</small>
            </td>
            <td><span className={offer.eligible?"pill good":"pill"}>{advertisedPriceLabel(offer)}</span>
              {!offer.eligible&&<small className="source-note">No usar este importe como precio final de compra</small>}
            </td>
            <td>{offer.productUrl?<a href={offer.productUrl} target="_blank" rel="noopener noreferrer" title="Comprueba referencia, variante, IVA y precio en la tienda">Comprobar ficha ↗</a>:"Enlace no disponible"}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
    <p className="alternatives-footnote">El precio encontrado puede venir de un índice de búsqueda y variar en la ficha, según la presentación seleccionada, impuestos, descuentos o identificación del cliente. El coste final solo se muestra cuando los datos permiten calcularlo; no se comparan referencias distintas como si fueran el mismo producto.</p>
  </section>;
}
