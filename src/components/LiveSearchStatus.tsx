export type LiveSearchState="idle"|"loading"|"success"|"partial"|"unavailable"|"failed";

export function LiveSearchStatus({state,completedAt,errors}:{state:LiveSearchState;completedAt?:string;errors:Array<{supplierId:string;message:string}>}){
  if(state==="idle") return null;
  if(state==="loading") return <section className="card live-status"><p className="eyebrow">CONSULTA EN VIVO</p><h3>Consultando precios actuales…</h3><p>Los snapshots anteriores no pueden ganar mientras se realiza esta búsqueda.</p></section>;
  if(state==="unavailable") return <section className="card live-status warning"><p className="eyebrow">CONSULTA EN VIVO NO CONFIGURADA</p><h3>No se declara ganador con datos guardados.</h3><p>Los precios del último refresh se muestran solo como referencia histórica hasta que el backend live esté conectado.</p></section>;
  if(state==="failed") return <section className="card live-status warning"><p className="eyebrow">CONSULTA EN VIVO FALLIDA</p><h3>No hay ganador actual verificable.</h3><p>Se conservan los snapshots como referencia, pero quedan excluidos del ranking.</p></section>;
  return <section className="card live-status success"><p className="eyebrow">PRECIOS CONSULTADOS AHORA</p><h3>{state==="partial"?"Consulta live parcial":"Consulta live completada"}</h3>
    <p>{completedAt?"Completada "+new Date(completedAt).toLocaleString("es-ES")+". ":""}Solo las ofertas de esta sesión pueden ganar.</p>
    {errors.length>0 && <div className="live-errors">{errors.map((error,index)=><small key={error.supplierId+"-"+index}>{error.supplierId}: {error.message}</small>)}</div>}
  </section>;
}