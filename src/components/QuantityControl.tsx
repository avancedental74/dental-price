export function QuantityControl({value,onChange}:{value:number;onChange:(n:number)=>void}){
  return <div className="qty">
    <span>Cantidad</span>
    <div className="qty-controls">
      <button onClick={()=>onChange(Math.max(1,value-1))} aria-label="Restar cantidad">−</button>
      <strong>{value}</strong>
      <button onClick={()=>onChange(value+1)} aria-label="Sumar cantidad">+</button>
    </div>
  </div>;
}