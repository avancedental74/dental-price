import { useEffect, useState, type FormEvent } from "react";
import type { CanonicalProduct, SupplierOffer, StockStatus, VatStatus } from "../types/domain";
import { buildManualOffer, type ManualOfferInput, upsertManualOffer } from "../services/manual-offers";

const supplierNames:Record<ManualOfferInput["supplierId"],string>={"proclinic":"Proclinic","dental-iberica":"Dental Ibérica","dvd-dental":"DVD Dental","dentalexpress":"Dental Express","brokerdental":"Broker Dental","ortodonland":"Ortodonland"};

export function ManualOfferPanel({product,offers,onChange,onRecord}:{product:CanonicalProduct|null;offers:SupplierOffer[];onChange:(offers:SupplierOffer[])=>void;onRecord:(offer:SupplierOffer)=>void}){
  const [supplierId,setSupplierId]=useState<ManualOfferInput["supplierId"]>("proclinic");
  const [productUrl,setProductUrl]=useState("");
  const [manufacturerReference,setManufacturerReference]=useState("");
  const [price,setPrice]=useState("");
  const [vatStatus,setVatStatus]=useState<VatStatus>("excluded");
  const [vatRate,setVatRate]=useState("10");
  const [stockStatus,setStockStatus]=useState<StockStatus>("in_stock");
  const [shippingCost,setShippingCost]=useState("");
  const [shippingVatRate,setShippingVatRate]=useState("21");
  const [shippingVatIncluded,setShippingVatIncluded]=useState(false);
  const [freeShippingThreshold,setFreeShippingThreshold]=useState("");
  const [freeShippingThresholdBasis,setFreeShippingThresholdBasis]=useState<"net"|"gross">("net");
  const [message,setMessage]=useState<string|null>(null);

  useEffect(()=>{setMessage(null);},[product?.id]);
  if(!product?.manufacturerReference) return null;
  const related=offers.filter(o=>o.manufacturerReference===product.manufacturerReference);

  const submit=(event:FormEvent)=>{
    event.preventDefault();
    try{
      const next=buildManualOffer(product,{
        supplierId,productUrl,manufacturerReference,price:Number(price),vatStatus,
        vatRate:vatStatus==="unknown"||vatRate===""?undefined:Number(vatRate),
        stockStatus,
        shippingCost:shippingCost===""?undefined:Number(shippingCost),
        shippingCostVatIncluded:shippingVatIncluded,
        shippingVatRate:shippingCost===""||shippingVatIncluded||shippingVatRate===""?undefined:Number(shippingVatRate),
        freeShippingThreshold:freeShippingThreshold===""?undefined:Number(freeShippingThreshold),
        freeShippingThresholdBasis
      });
      onChange(upsertManualOffer(offers,next));
      onRecord(next);
      setMessage("Oferta manual e histórico guardados en este navegador.");
    }catch(error){setMessage(error instanceof Error?error.message:"No se pudo guardar la oferta");}
  };

  return <section className="card manual-panel">
    <div className="section-head"><div><p className="eyebrow">VERIFICACIÓN MANUAL</p><h3>Proveedor bloqueado para automatización</h3></div><span>Solo se guarda en este navegador</span></div>
    <p className="manual-note">Usa esta vía para Proclinic, Dental Ibérica o DVD Dental cuando compruebes la ficha en tu navegador. La referencia queda fijada a <strong>{product.manufacturerReference}</strong>; si faltan IVA, portes o stock, la oferta no podrá ganar.</p>
    <form className="manual-form" onSubmit={submit}>
      <label>Proveedor<select value={supplierId} onChange={e=>setSupplierId(e.target.value as ManualOfferInput["supplierId"])}><option value="proclinic">Proclinic</option><option value="dental-iberica">Dental Ibérica</option><option value="dvd-dental">DVD Dental</option><option value="dentalexpress">Dental Express</option><option value="brokerdental">Broker Dental</option><option value="ortodonland">Ortodonland</option></select></label>
      <label>URL de la ficha<input required type="url" value={productUrl} onChange={e=>setProductUrl(e.target.value)} placeholder="https://…"/></label>
      <label>Ref. fabricante observada<input required value={manufacturerReference} onChange={e=>setManufacturerReference(e.target.value)} placeholder={product.manufacturerReference}/></label>
      <label>Precio web (€)<input required min="0.01" step="0.01" type="number" value={price} onChange={e=>setPrice(e.target.value)}/></label>
      <label>IVA<select value={vatStatus} onChange={e=>setVatStatus(e.target.value as VatStatus)}><option value="excluded">No incluido</option><option value="included">Incluido</option><option value="unknown">No confirmado</option></select></label>
      <label>IVA %<input min="0" step="0.01" type="number" disabled={vatStatus==="unknown"} value={vatRate} onChange={e=>setVatRate(e.target.value)}/></label>
      <label>Stock<select value={stockStatus} onChange={e=>setStockStatus(e.target.value as StockStatus)}><option value="in_stock">Disponible</option><option value="low_stock">Pocas unidades</option><option value="backorder">Bajo pedido</option><option value="unavailable">Agotado</option><option value="unknown">No confirmado</option></select></label>
      <label>Portes (€)<input min="0" step="0.01" type="number" value={shippingCost} onChange={e=>setShippingCost(e.target.value)} placeholder="Déjalo vacío si no lo sabes"/></label>
      <label>Portes incluyen IVA<select value={shippingVatIncluded?"yes":"no"} onChange={e=>setShippingVatIncluded(e.target.value==="yes")}><option value="no">No</option><option value="yes">Sí</option></select></label>
      <label>IVA portes %<input min="0" step="0.01" type="number" disabled={shippingVatIncluded} value={shippingVatRate} onChange={e=>setShippingVatRate(e.target.value)}/></label>
      <label>Envío gratis desde (€)<input min="0" step="0.01" type="number" value={freeShippingThreshold} onChange={e=>setFreeShippingThreshold(e.target.value)} placeholder="Opcional"/></label>
      <label>Base del umbral<select value={freeShippingThresholdBasis} onChange={e=>setFreeShippingThresholdBasis(e.target.value as "net"|"gross")}><option value="net">Antes de IVA</option><option value="gross">IVA incluido</option></select></label>
      <button type="submit">Guardar oferta verificada</button>
    </form>
    {message&&<p className="manual-message">{message}</p>}
    {related.length>0&&<div className="manual-saved">{related.map(o=><div key={`${o.supplierId}-${o.manufacturerReference}`}><span><strong>{supplierNames[o.supplierId as ManualOfferInput["supplierId"]]??o.supplierId}</strong> · {(o.salePrice??o.regularPrice).toFixed(2)} € · {new Date(o.observedAt).toLocaleString("es-ES")}</span><button type="button" onClick={()=>onChange(offers.filter(x=>x!==o))}>Eliminar</button></div>)}</div>}
  </section>;
}