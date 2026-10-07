import type { ConnectorStatus } from "../services/public-data";
const names:Record<string,string>={"dentaltix":"Dentaltix","proclinic":"Proclinic","dental-iberica":"Dental Ibérica","dentalcost":"DentalCost","dvd-dental":"DVD Dental"};

export function ConnectorStatusPanel({items}:{items:ConnectorStatus[]}){
  const latest=new Map<string,ConnectorStatus>();
  for(const item of items){
    const prev=latest.get(item.supplierId);
    if(!prev || new Date(item.checkedAt)>new Date(prev.checkedAt)) latest.set(item.supplierId,item);
  }
  const suppliers=["dentaltix","dentalcost","dvd-dental","proclinic","dental-iberica"];
  return <section className="card">
    <div className="section-head"><div><p className="eyebrow">FUENTES</p><h3>Estado de conectores</h3></div></div>
    <div className="stats-grid">{suppliers.map(id=>{
      const s=latest.get(id);
      return <span key={id}>{names[id]} <b>{s ? (s.status==="green"?"Operativo":s.status==="amber"?"Revisar":"Error") : "Sin comprobar"}</b><small>{s?.message ?? "Aún sin ejecución registrada"}</small></span>;
    })}</div>
  </section>;
}