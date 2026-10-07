import type { CanonicalProduct } from "../types/domain";
import type { ConnectorStatus } from "../services/public-data";

interface CoverageItem {
  product: CanonicalProduct;
  purchasableSuppliers: string[];
  verifiedSuppliers: string[];
  manualSuppliers: string[];
}

function supplierSet(items:ConnectorStatus[],productId:string,predicate:(item:ConnectorStatus)=>boolean){
  return [...new Set(items.filter(item=>item.productId===productId&&predicate(item)).map(item=>item.supplierId))].sort();
}

export function CoverageQueue({products,connectors,onSelect}:{products:CanonicalProduct[];connectors:ConnectorStatus[];onSelect:(id:string)=>void}){
  const items:CoverageItem[]=products
    .filter(product=>product.active)
    .map(product=>({
      product,
      purchasableSuppliers:supplierSet(connectors,product.id,item=>Boolean(item.purchasable)),
      verifiedSuppliers:supplierSet(connectors,product.id,item=>item.verificationStatus==="verified"),
      manualSuppliers:supplierSet(connectors,product.id,item=>item.verificationStatus==="manual_required")
    }))
    .filter(item=>item.purchasableSuppliers.length<2)
    .sort((a,b)=>
      a.purchasableSuppliers.length-b.purchasableSuppliers.length ||
      a.verifiedSuppliers.length-b.verifiedSuppliers.length ||
      a.product.family.localeCompare(b.product.family)
    )
    .slice(0,12);

  if(!items.length) return null;

  return <section className="card coverage-card">
    <div className="section-head">
      <div><p className="eyebrow">COBERTURA PENDIENTE</p><h3>Siguiente expansión prioritaria</h3></div>
      <span>{items.length} prioridades visibles</span>
    </div>
    <p className="manual-note">Primero aparecen los productos sin ninguna oferta comprable y después los que solo tienen un proveedor comprable. Así se amplía comparación real antes que volumen de catálogo.</p>
    <div className="coverage-list">
      {items.map(item=><button key={item.product.id} type="button" className="coverage-row" onClick={()=>onSelect(item.product.id)}>
        <span>
          <b>{item.product.family}{item.product.shade?` · ${item.product.shade}`:""}{item.product.variant?` ${item.product.variant}`:""}</b>
          <small>Ref. {item.product.manufacturerReference??"—"} · {item.product.category}</small>
        </span>
        <span className="coverage-counts">
          <em>{item.purchasableSuppliers.length} comprable{item.purchasableSuppliers.length===1?"":"s"}</em>
          <small>{item.verifiedSuppliers.length} verificado{item.verifiedSuppliers.length===1?"":"s"}{item.manualSuppliers.length?` · ${item.manualSuppliers.length} manual${item.manualSuppliers.length===1?"":"es"}`:""}</small>
        </span>
      </button>)}
    </div>
  </section>;
}