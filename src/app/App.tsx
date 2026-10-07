export function App() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">DENTAL PRICE · MVP</p>
        <h1>Encuentra el mejor precio encontrado entre los proveedores consultados.</h1>
        <p className="subtitle">
          Comparación por producto real, cantidad, promoción, stock, transporte e histórico.
        </p>

        <div className="search">
          <input
            aria-label="Buscar producto"
            placeholder="Ej. Filtek Supreme XTE A3 Body 3 g"
            disabled
          />
          <button disabled>Buscar</button>
        </div>

        <p className="status">
          Fase 1 activa: arquitectura, modelo de datos y validación.
        </p>
      </section>
    </main>
  );
}
