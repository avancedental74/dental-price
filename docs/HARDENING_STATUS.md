# Dental Price — Hardening Status

Fecha: 2026-10-07

## Estado real

La arquitectura, motores de dominio, validación, CI, seguridad y frontend están endurecidos. El último refresh publicado generó **93 ofertas automáticas**, **109 observaciones históricas** y **0 falsos EXACT** en validación.

## Cobertura automática actual

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

La ficha pública y el health check son accesibles. La web expone IDs internos de variante y un endpoint público de atributos, pero las pruebas reproducibles desde GitHub Actions devuelven el SKU/precio base en lugar del SKU/precio específico de la variante seleccionada. Para evitar falsos EXACT, las variantes DVD se mantienen en `manual_verification`.

La interfaz admite snapshots DVD verificados manualmente y exige:
- dominio `dvd-dental.com`;
- referencia de fabricante observada coincidente;
- precio >0;
- datos económicos suficientes antes de poder ganar el ranking.

### Proclinic

Las fichas públicas son visibles en navegador/buscadores, pero GitHub Actions recibe HTTP 405. Se usa `manual_verification`. El snapshot se guarda solo en `localStorage`, exige dominio correcto y referencia coincidente y conserva histórico local.

### Dental Ibérica

Las fichas públicas son visibles en navegador/buscadores, pero GitHub Actions recibe HTTP 405. Se usa `manual_verification` con las mismas garantías que Proclinic.

## Ejemplo de comparación automática real

Producto: Filtek Supreme XTE A3 Body, ref. `4910A3B`, 1 jeringa de 3 g.

- Dentaltix: precio base 44,90 €, IVA 10 %, portes 4,95 € + IVA → coste efectivo 55,38 €.
- DentalCost: precio base 47,86 €, IVA 10 %, portes 5,80 € + IVA → coste efectivo 59,67 €.

El motor debe seleccionar Dentaltix para una unidad con las condiciones observadas. Existe un test de regresión que fija este comportamiento y otro para comprobar que al superar los umbrales desaparecen los portes.

## Principio de seguridad de datos

Si una fuente no puede verificarse automáticamente, Dental Price debe mostrar ausencia de dato / dato no confirmado. Nunca debe fabricar un precio, reutilizar uno stale como actual ni sortear controles del proveedor.

## Limitaciones abiertas

1. No existe discovery arbitrario de todo el catálogo; la búsqueda opera sobre catálogo canónico curado.
2. Proclinic y Dental Ibérica requieren API/feed/autorización o verificación manual.
3. DVD requiere una vía fiable para resolver variante→SKU/precio antes de volver a automatización.
4. Dentaltix y DentalCost deben ampliar progresivamente categorías y referencias, priorizando familias compartidas con referencia de fabricante idéntica. Filtek Universal Restorative ya aporta 9 referencias comparables entre ambos; `6555XW` permanece solo en Dentaltix mientras DentalCost no la publique. AIR-N-GO en DentalCost quedó fuera de la automatización porque esa ficha devuelve HTTP 404 desde GitHub Actions aunque sea visible públicamente.
5. Opportunity Score necesita más días de histórico real para ser estadísticamente útil.
6. Precios negociados, facturas e inventario interno están fuera del V1 público.
7. Optimización matemática de cesta multi-proveedor queda para la siguiente fase.

## Seguridad de dependencias

- `package-lock.json` versionado y `npm ci` obligatorio.
- Vite 8.3.3.
- Auditoría de producción y auditoría completa con umbral `high` en verde.
- CI ejecuta typecheck, lint, tests, validación de datos y build.
