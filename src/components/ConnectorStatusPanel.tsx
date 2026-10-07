import type { ConnectorStatus } from "../services/public-data";

const names:Record<string,string>={
  "dentaltix":"Dentaltix",
  "dentalcost":"DentalCost",
  "dvd-dental":"DVD Dental",
  "proclinic":"Proclinic",
  "dental-iberica":"Dental Ibérica",
  "dentalexpress":"Dental Express",
  "brokerdental":"Broker Dental",
  "ortodonland":"Ortodonland"
};

export function ConnectorStatusPanel({items}:{items:ConnectorStatus[]}){
  const suppliers=["dentaltix","dentalcost","dvd-dental","proclinic","dental-iberica","dentalexpress","brokerdental","ortodonland"];
  return <section className="card">
    <div className="section-head"><div><p className="eyebrow">FUENTES</p><h3>Estado de proveedores</h3></div></div>
    <div className="stats-grid">{suppliers.map(id=>{
      const rows=items.filter(item=>item.supplierId===id);
      const verified=rows.filter(r=>r.verificationStatus==="verified").length;
      const purchasable=rows.filter(r=>r.verificationStatus==="verified"&&r.purchasable).length;
      const failed=rows.filter(r=>r.verificationStatus==="failed").length;
      const manual=rows.filter(r=>r.verificationStatus==="manual_required").length;
      const label=purchasable>0 ? "Con ofertas comprables" : verified>0 ? "Verificado sin compra" : failed>0 ? "Fallo de verificación" : manual>0 ? "Manual" : "Pendiente de integrar";
      const detail=rows.length ? [verified?verified+" verificadas":null,purchasable?purchasable+" comprables":null,failed?failed+" fallidas":null,manual?manual+" manuales":null].filter(Boolean).join(" · ") : "Aún sin ejecución registrada";
      return <span key={id}>{names[id]} <b>{label}</b><small>{detail}</small></span>;
    })}</div>
  </section>;
}