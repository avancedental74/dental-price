import { useState } from "react";

export function SearchBar({onSearch}:{onSearch:(q:string)=>void}){
  const [value,setValue]=useState("");
  return <form className="searchbar" onSubmit={e=>{e.preventDefault();onSearch(value.trim());}}>
    <input value={value} onChange={e=>setValue(e.target.value)} placeholder="Producto, referencia o EAN" aria-label="Buscar producto"/>
    <button type="submit">Buscar</button>
  </form>;
}