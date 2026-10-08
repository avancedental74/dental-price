# Dental Price — Hardening Status

Fecha: 2026-10-08

## Estado real

La arquitectura actual ya no depende del catálogo canónico para la búsqueda interactiva. El frontend ejecuta una **búsqueda federada live por nombre o referencia**, cada consulta genera un `sessionId` y únicamente las ofertas verificadas dentro de esa sesión pueden competir. El snapshot programado permanece como histórico y referencia auxiliar.

El Worker aplica validación de esquema, política del proveedor, control de anomalías contra histórico y filtrado de relevancia antes de devolver una oferta. Los despliegues están serializados para impedir que una ejecución antigua sobrescriba una versión nueva.

## Cobertura automática actual

- **7 proveedores live automáticos**: Dentaltix, DentalCost, DVD Dental, Dental Express, Ortolan, Dentipak y Dental Boom.
- **3 proveedores protegidos por AWS WAF/CAPTCHA**: Proclinic, Dental Ibérica y Broker Dental. No se intenta eludir la verificación humana.
- El smoke test de despliegue exige respuestas válidas de los 7 proveedores automáticos.
- La prueba de búsqueda no precargada con `Tetric EvoCeram` confirma discovery live real en proveedores accesibles sin depender de `data/products.json`.
- El histórico local de búsquedas live se conserva en el navegador y se combina con el histórico público para detección de anomalías y estadísticas.


- **Dentaltix: 42 ofertas verdes / EXACT**
  - 13 variantes Filtek Supreme XTE.
  - 10 variantes Filtek Universal Restorative jeringa de 4 g.
  - 7 variantes Filtek Z250 jeringa de 4 g.
  - 4 variantes RelyX Universal.
  - Scotchbond Universal Plus `41294`.
  - Adper Scotchbond 1XT `4242`.
  - 4 tallas de guantes Santex nitrilo negro: XS, S, M y L.
  - 2 referencias Peeso 28 mm: Nº1 y Nº2.
- **DentalCost: 51 ofertas verdes / EXACT**
  - 24 variantes Filtek Supreme XTE Body, Dentin y Enamel.
  - 9 variantes Filtek Universal Restorative jeringa de 4 g; `6555XW` no aparece en la ficha pública actual.
  - 10 variantes Filtek Z250 jeringa de 4 g.
  - 4 variantes RelyX Universal.
  - Scotchbond Universal Plus `41294`.
  - Adper Scotchbond 1XT `4242`.
  - 2 referencias Peeso 28 mm: Nº1 y Nº2.
- Hay comparación automática proveedor contra proveedor en composites, endodoncia, cementos y adhesivos.

## Validado

- Matching EXACT exige identificador fuerte y campos críticos completos.
- Contradicciones de referencia, variante, tono, presentación, cantidad o pack rechazan el match.
- Alias controlados de fabricante para Dentsply / Dentsply Maillefer / Dentsply Sirona.
- Pricing Engine calcula en céntimos enteros.
- IVA y portes no se inventan.
- Umbral de envío admite base neta o bruta.
- Solo ofertas EXACT, normales, no stale y con stock confirmado pueden ganar.
- Anomaly Engine detecta cero/negativos, caídas >50%, subidas >100%, x10 y drift de pack/unidad/presentación.
- Histórico separa proveedor y cantidad y guarda coste unitario efectivo + coste total.
- Estadísticas históricas usan ponderación temporal.
- Opportunity Score exige mínimo 5 observaciones y cobertura temporal suficiente.
- Frontend consume JSON generado, no datos demo.
- Ground truth >=30 casos, con composites, profilaxis, endodoncia y controles negativos.
- CI: npm ci, typecheck, lint, tests, validate:data y build.
- Security audit automatizado.
- Dependencias fijadas por package-lock.
- El workflow de refresh reintenta contra el último `main` si existe una carrera de escritura.
- Todas las peticiones de refresh y health tienen timeout de 15 segundos.

## Adquisición de proveedores

### Dentaltix

Automatización operativa mediante fichas públicas y SKU explícito. Las ofertas se aceptan únicamente cuando referencia de fabricante, variante, presentación, cantidad y pack son compatibles con el producto canónico.

Ejemplos verificados:
- Filtek Supreme XTE A3 Body `4910A3B`: 44,90 € antes de IVA, IVA 10 %, stock confirmado.
- Filtek Z250 `6020A3`: 61,90 € antes de IVA, jeringa 4 g, stock confirmado.
- RelyX Universal `56972`: 133,90 € antes de IVA, jeringa 3,4 g, tono A1, stock confirmado.
- Scotchbond Universal Plus `41294`: 79,90 € antes de IVA, frasco 5 ml, stock confirmado.
- Adper Scotchbond 1XT `4242`: 123,90 € antes de IVA, frasco 6 ml, stock confirmado.
- Guantes Santex negro: caja de 100 unidades, talla identificada por referencia, IVA 21 %.
- Peeso 28 mm: pack de 6, número y longitud separados correctamente, IVA 21 %.

### DentalCost

Automatización operativa. Las fichas públicas exponen referencias de fabricante, referencia del depósito, stock y precio por variante. Se han validado 24 variantes Filtek Supreme XTE, 10 Filtek Z250 jeringa, 4 RelyX Universal, Scotchbond Universal Plus 41294, Adper Scotchbond 1XT 4242 y 2 referencias Peeso 28 mm. El transporte se modela como 5,80 € antes de IVA y envío gratuito desde 120 € IVA incluido. El parser de fichas simples recupera identidad, precio y stock. En el último refresh Adper 4242 y Scotchbond Universal Plus 41294 quedaron con stock confirmado y pueden competir en el ranking.

### DVD Dental

Búsqueda live mediante Klevu para discovery y verificación posterior sobre la ficha del producto. La consulta limita candidatos para mantenerse dentro del presupuesto de CPU del Worker y rechaza resultados que no superan relevancia o validación comercial.

### Dental Express

Búsqueda live operativa. La referencia interna y la referencia de fabricante se tratan como campos distintos. Si la ficha no expone un precio producto-específico verificable, devuelve `noMatch` en lugar de reutilizar precios globales o ambiguos.

### Ortolan

Búsqueda live basada en datos estructurados del propio buscador. Se extraen variante, tono, presentación, cantidad, pack, precio y stock publicado sin descargar múltiples fichas pesadas. Las variantes se mantienen separadas.

### Dentipak

Búsqueda live validada mediante smoke test con referencia, SKU, precio y stock verificables.

### Dental Boom

Discovery mediante API pública de WooCommerce y verificación posterior en ficha. Los resultados sin referencia de fabricante pueden mostrarse, pero no se inventa esa referencia.

### Proclinic

Las fichas públicas son visibles en navegador/buscadores, pero GitHub Actions recibe HTTP 405. Se usa `manual_verification`. El snapshot se guarda solo en `localStorage`, exige dominio correcto y referencia coincidente y conserva histórico local.

### Dental Ibérica

AWS WAF devuelve verificación humana a peticiones de servidor, incluidas rutas de catálogo/API probadas. Se mantiene fuera de la automatización live.

### Broker Dental

AWS WAF devuelve verificación humana a peticiones de servidor y a las rutas de API probadas. Se mantiene fuera de la automatización live.

## Ejemplo de comparación automática real

Producto: Filtek Supreme XTE A3 Body, ref. `4910A3B`, 1 jeringa de 3 g.

- Dentaltix: precio base 44,90 €, IVA 10 %, portes 4,95 € + IVA → coste efectivo 55,38 €.
- DentalCost: precio base 47,86 €, IVA 10 %, portes 5,80 € + IVA → coste efectivo 59,67 €.

El motor debe seleccionar Dentaltix para una unidad con las condiciones observadas. Existe un test de regresión que fija este comportamiento y otro para comprobar que al superar los umbrales desaparecen los portes.

## Principio de seguridad de datos

Si una fuente no puede verificarse automáticamente, Dental Price debe mostrar ausencia de dato / dato no confirmado. Nunca debe fabricar un precio, reutilizar uno stale como actual ni sortear controles del proveedor.

## Limitaciones abiertas

1. Proclinic, Dental Ibérica y Broker Dental requieren navegación humana o una API/feed autorizado por el proveedor.
2. Algunos proveedores no publican referencia de fabricante en todos los productos. En esos casos la interfaz puede mostrar candidatos, pero el ranking debe seguir siendo conservador.
3. Algunas búsquedas por nombre devuelven familias con muchas variantes; la UI debe mantener selección explícita y no colapsar presentaciones, tonos o packs incompatibles.
4. El histórico live persistente entre dispositivos todavía no usa una base central; el navegador conserva observaciones locales y el snapshot público aporta el histórico compartido.
5. Opportunity Score necesita más histórico temporal por SKU para ganar valor estadístico.
6. Precios negociados, facturas e inventario interno siguen fuera del alcance público actual.
7. El Basket Optimizer necesita consultas live por todas las líneas de la cesta para que su optimización sea completamente actual al momento de compra.

## Seguridad de dependencias

- `package-lock.json` versionado y `npm ci` obligatorio.
- Vite 8.3.3.
- Auditoría de producción y auditoría completa con umbral `high` en verde.
- CI ejecuta typecheck, lint, tests, validación de datos y build.


## Endurecimiento posterior a auditoría crítica

- `current-prices.json` se reconstruye desde cero en cada refresh; un fallo actual no conserva un precio antiguo como vigente.
- `connector-status.json` separa `verificationStatus`, `matchStatus` y `purchasable`.
- `data/metrics.json` publica cobertura real: ofertas verificadas, comprables, stock, productos con ≥2 proveedores y proveedores automáticos.
- Último snapshot verificado: 94 ofertas, 84 comprables, 10 agotadas, 11 con stock bajo, 37 productos con ≥2 proveedores verificados y 34 con ≥2 proveedores comprables.
- Políticas de transporte externalizadas en `data/supplier-policies.json`.
- Registry central de referencias elimina reglas duplicadas de producto en conectores.
- Búsqueda ambigua ya no selecciona silenciosamente el primer resultado.
- Promociones visibles se estructuran; promociones cruzadas a otro producto quedan informativas.
- Basket Optimizer V1 cobra portes una sola vez por proveedor, aplica los umbrales de forma conservadora y usa poda + memoización para evitar explosión cartesiana.
- La validación incluye el fixture manual y regresiones sobre todo el catálogo canónico para referencia propia y referencia contradictoria.


### Políticas de transporte

- Dentaltix, DentalCost y DVD Dental tienen las condiciones de portes fuera de los conectores en `data/supplier-policies.json`.
- `Refresh supplier policies` verifica semanalmente las páginas públicas de condiciones y solo renueva `observedAt` si coste, umbral y base neta/bruta siguen siendo compatibles con la política almacenada.
- Si una política automática supera 30 días sin poder revalidarse, sus ofertas dejan de ser elegibles para ranking aunque el precio del producto siga accesible.
- Última verificación automática correcta: 07/10/2026.


### Verificación manual

El modo manual ya no presupone que los portes estén sin IVA ni que el umbral de envío gratis sea neto. El usuario debe indicar explícitamente ambas condiciones; si faltan datos económicos, la oferta puede conservarse como referencia pero no ganar el ranking.
