# Dental Price — Hardening Status

Fecha: 2026-10-07

## Estado real

La arquitectura, motores de dominio, validación, CI, seguridad y frontend están endurecidos. Dentaltix dispone de automatización validada para 13 variantes Filtek Supreme XTE. Proclinic y Dental Ibérica siguen limitados por el comportamiento de sus sitios desde GitHub Actions.

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
Automatización operativa y validada para 13 variantes Filtek Supreme XTE con SKU Dentaltix `053M…`. El refresh real del 2026-10-07 produjo 13 ofertas, 13 históricos y 0 falsos `EXACT`: 12 variantes en stock y `4910B2E` con stock bajo. Las variantes verificadas muestran 44,90 € antes de IVA, IVA 10%; para una unidad el motor calcula 55,38 € incluyendo portes cuando aplica el coste estándar. La cobertura seguirá ampliándose solo con mappings SKU↔referencia verificables.

### Proclinic
Las fichas públicas son visibles en navegador/buscadores, pero GitHub Actions recibe HTTP 405. Se usa `manual_verification` para evitar peticiones repetidas que el sitio rechaza. La interfaz permite registrar un snapshot verificado manualmente que se guarda únicamente en `localStorage` del navegador, exige dominio correcto y referencia de fabricante coincidente, pasa por el mismo matching/pricing y conserva histórico local.

### Dental Ibérica
Las fichas públicas son visibles en navegador/buscadores, pero GitHub Actions recibe HTTP 405. Se usa `manual_verification` para evitar peticiones repetidas que el sitio rechaza. La interfaz permite registrar snapshots verificados en `localStorage`, con validación de dominio y referencia, y conserva histórico local para scoring futuro.

## Principio de seguridad de datos

Si una fuente no puede verificarse automáticamente, Dental Price debe mostrar ausencia de dato / dato no confirmado. Nunca debe fabricar un precio, reutilizar uno antiguo como actual ni sortear controles del proveedor.

## Limitaciones abiertas

1. No existe discovery arbitrario de todo el catálogo de los proveedores; la búsqueda opera sobre el catálogo canónico curado.
2. Proclinic y Dental Ibérica requieren una vía permitida de actualización (API/feed/autorización o verificación manual).
3. Dentaltix funciona para 13 variantes verificadas; falta ampliar la cobertura automática al resto del catálogo con referencias trazables.
4. El Opportunity Score permanecerá insuficiente hasta acumular histórico real suficiente.
5. Los precios negociados, facturas e inventario interno están fuera del V1 público.

Estas limitaciones son externas/de alcance y no deben ocultarse en la interfaz ni en documentación.

## Seguridad de dependencias

- `package-lock.json` versionado y `npm ci` obligatorio en CI.
- Vite actualizado a 8.3.3.
- Auditoría de producción y auditoría completa con umbral `high` pasan en verde.
- El CI ejecuta typecheck, lint, tests, validación de datos y build.
