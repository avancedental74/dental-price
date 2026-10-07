# Dental Price — Hardening Status

Fecha: 2026-10-07

## Estado real

La arquitectura, motores de dominio, validación, CI, seguridad y frontend están endurecidos. Dentaltix ya dispone de una ruta automática validada para el SKU 4910A3B. Proclinic y Dental Ibérica siguen limitados por el comportamiento de sus sitios desde GitHub Actions.

## Validado

- Matching EXACT exige identificador fuerte y campos críticos completos.
- Contradicciones de referencia, variante, tono, presentación, cantidad o pack rechazan el match.
- Pricing Engine calcula en céntimos enteros.
- IVA y portes no se inventan.
- Umbral de envío admite base neta o bruta.
- Solo ofertas EXACT, normales, no stale y con stock confirmado pueden ganar.
- Anomaly Engine detecta cero/negativos, caídas >50%, subidas >100%, x10 y drift de pack/unidad/presentación.
- Histórico separa cantidad y guarda coste unitario efectivo + coste total.
- Estadísticas históricas usan ponderación temporal.
- Opportunity Score exige mínimo 5 observaciones y cobertura temporal suficiente.
- Frontend consume JSON generado, no datos demo.
- Ground truth >= 30 casos; actualmente incluye composites, profilaxis, endodoncia y controles negativos.
- CI: npm ci, typecheck, lint, tests, validate:data y build.
- Security audit automatizado.
- Dependencias fijadas por package-lock.

## Adquisición de proveedores

### Dentaltix
Automatización operativa y validada para `Filtek Supreme XTE A3 Body`, ref. fabricante `4910A3B`, SKU Dentaltix `053M4910A3B`. El conector extrae referencia, variante, presentación, cantidad, stock, precio base, IVA y portes de forma trazable. A 2026-10-07 la observación automática registrada es 44,90 € antes de IVA, IVA 10%, en stock; coste efectivo para 1 unidad en Península: 55,38 € incluyendo portes. La cobertura del catálogo todavía debe ampliarse SKU a SKU con mappings verificables.

### Proclinic
Las fichas públicas son visibles en navegador/buscadores, pero GitHub Actions recibe HTTP 405. Se usa `manual_verification` para evitar peticiones repetidas que el sitio rechaza.

### Dental Ibérica
Las fichas públicas son visibles en navegador/buscadores, pero GitHub Actions recibe HTTP 405. Se usa `manual_verification` para evitar peticiones repetidas que el sitio rechaza.

## Principio de seguridad de datos

Si una fuente no puede verificarse automáticamente, Dental Price debe mostrar ausencia de dato / dato no confirmado. Nunca debe fabricar un precio, reutilizar uno antiguo como actual ni sortear controles del proveedor.

## Limitaciones abiertas

1. No existe discovery arbitrario de todo el catálogo de los proveedores; la búsqueda opera sobre el catálogo canónico curado.
2. Proclinic y Dental Ibérica requieren una vía permitida de actualización (API/feed/autorización o verificación manual).
3. Dentaltix funciona para el primer SKU validado; falta ampliar la cobertura automática al resto del catálogo con referencias trazables.
4. El Opportunity Score permanecerá insuficiente hasta acumular histórico real suficiente.
5. Los precios negociados, facturas e inventario interno están fuera del V1 público.

Estas limitaciones son externas/de alcance y no deben ocultarse en la interfaz ni en documentación.