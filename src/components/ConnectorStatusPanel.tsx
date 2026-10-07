import type { ConnectorStatus } from "../services/public-data";

const names:Record<string,string>={
  "dentaltix":"Dentaltix",
  "dentalcost":"DentalCost",
  "dvd-dental":"DVD Dental",
  "proclinic":"Proclinic",
  "dental-iberica":"Dental Ibérica"
};

export function ConnectorStatusPanel({items}:{items:ConnectorStatus[]}){
  const suppliers=["dentaltix","dentalcost","dvd-dental","proclinic","dental-iberica"];
  return <section className="card">
    <div className="section-head"><div><p className="eyebrow">FUENTES</p><h3>Estado de proveedores</h3></div></div>
    <div className="stats-grid">{suppliers.map(id=>{
      const rows=items.filter(item=>item.supplierId===id);
      const green=rows.filter(row=>row.status==="green").length;
      const amber=rows.filter(row=>row.status==="amber").length;
      const red=rows.filter(row=>row.status==="red").length;
      const label=green>0 && amber===0 && red===0 ? "Operativo" : green>0 ? "Parcial" : red>0 && amber===0 ? "Error" : rows.length ? "Requiere revisión" : "Sin comprobar";
      const detail=rows.length ? [green?green+" automáticas":null,amber?amber+" manual/revisión":null,red?red+" error":null].filter(Boolean).join(" · ") : "Aún sin ejecución registrada";
      return <span key={id}>{names[id]} <b>{label}</b><small>{detail}</small></span>;
    })}</div>
  </section>;
}