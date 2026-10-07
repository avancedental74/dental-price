import type { MatchedSupplierOffer } from "../domain/comparison/types";

const names:Record<string,string>={"dentaltix":"Dentaltix","dentalcost":"DentalCost","dvd-dental":"DVD Dental","proclinic":"Proclinic","dental-iberica":"Dental Ibérica"};

export function WinnerCard({item}:{item:MatchedSupplierOffer}){
  const p=item.pricing;
  return <section className="winner card">
    <div><p className="eyebrow">MEJOR OPCIÓN VERIFICADA AHORA</p><h2>{names[item.offer.supplierId] ?? item.offer.supplierId}</h2><small className="live-proof">Verificado {item.offer.verifiedAt?new Date(item.offer.verifiedAt).toLocaleTimeString("es-ES"):"en esta búsqueda"}</small></div>
    <div className="winner-price"><strong>{p?.effectiveTotalCost.toFixed(2)} €</strong><span>{p?.effectiveUnitCost.toFixed(2)} €/ud efectiva</span></div>
    <div className="winner-grid">
      <span>Precio base <b>{p?.baseUnitPrice.toFixed(2)} €</b></span>
      <span>Portes <b>{p?.shippingCost===null?"No confirmado":`${p?.shippingCost.toFixed(2)} €`}</b></span>
      <span>Stock <b>{item.offer.stockStatus==="in_stock"?"Disponible":item.offer.stockStatus}</b></span>
      <span>Match <b>{item.match.status}</b></span>
    </div>
    {item.offer.promotion && <div className="promo">{item.offer.promotion.description}</div>}
    <a href={item.offer.productUrl} target="_blank" rel="noreferrer">Ver producto</a>
  </section>;
}