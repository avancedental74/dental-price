import type { ConnectorStatusPayload } from "../services/data";

const labels:Record<string,string>={dentaltix:"Dentaltix",proclinic:"Proclinic","dental-iberica":"Dental Ibérica"};
export function ConnectorStatus({data}:{data:ConnectorStatusPayload}){
  const entries=Object.entries(data.suppliers);
  return <section className="card connector-card">
    <div className="section-head"><div><p className="eyebrow">FUENTES</p><h3>Estado de conectores</h3></div><span>{data.generatedAt?new Date(data.generatedAt).toLocaleString("es-ES"):"Sin comprobación"}</span></div>
    <div className="connector-grid">{entries.length?entries.map(([id,s])=><div className="connector-item" key={id}>
      <span className={`dot ${s.status}`}></span><div><strong>{labels[id]??id}</strong><small>{s.message}</small></div>
    </div>):<p className="empty">Todavía no hay un health check publicado.</p>}</div>
  </section>;
}