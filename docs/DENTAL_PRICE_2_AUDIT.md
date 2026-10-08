# Dental Price 2.0 - auditoria inicial

Fecha: 2026-10-08
Rama: `mejora-dental-price-v2`
Commit base: `83e8f50e7a777c2bbd77fb717813d2d045e05de4`

## Diagnostico confirmado

| Area | Evidencia | Gravedad | Decision aplicada |
| --- | --- | --- | --- |
| Busqueda live | `src/services/live-prices.ts` consulta los 7 proveedores automaticos con `sessionId`, concurrencia limitada y reintento controlado. | Media | Mantener la arquitectura federada; no volver al catalogo precargado como requisito. |
| Agrupacion | `groupLiveOffers()` separaba variantes incompatibles, pero no exponia un registro formal de identidad ni razones de agrupacion. | Alta | Anadir `identityLevel`, `identityReasons` y `LiveDiscoveryRecord` para que ningun candidato recuperado desaparezca sin clasificacion. |
| Evidencia economica | `assessProducts()` distinguia `search_index` de ficha y ranking, pero la UI no usaba el modelo A/B/C pedido. | Alta | Anadir `verificationLevel: A/B/C` en `UniversalOffer` y etiquetas visibles en precios publicados. |
| UX de resultados | `UniversalSearchResults.tsx` ya agrupaba ofertas por producto y mostraba proveedores, pero no explicaba si la identidad era exacta, probable o insuficiente. | Media | Mostrar el nivel de identidad y las razones en cada tarjeta de producto. |
| Proveedores protegidos | `HARDENING_STATUS.md` y `worker/live-api.ts` confirman WAF/CAPTCHA en Proclinic, Dental Iberica y Broker Dental. | Alta | Mantenerlos como enlaces de verificacion humana; no intentar evasion. |
| Workflows | `.github/workflows/test.yml` ejecuta typecheck, lint, tests, validate:data y build. `deploy-live-api.yml` contiene smoke tests reales del Worker. | Media | Conservar workflows y validar localmente antes de commitear. |

## Riesgos abiertos

- La cobertura real sigue dependiendo de disponibilidad publica de cada proveedor; no se puede afirmar exhaustividad nacional.
- Los precios `search_index` son utiles para descubrimiento, pero permanecen como Nivel C.
- El historico central entre dispositivos sigue sin D1 u otra persistencia compartida; no se migra sin plan de reversibilidad.
- La validacion live contra proveedores externos no se ejecuta en local en esta fase; se conserva en smoke tests del workflow de Worker.

## Validacion de esta fase

- `npm.cmd run typecheck`
- `npm.cmd test -- tests/services/live-prices.test.ts tests/domain/universal-search.test.ts tests/components/all-supplier-prices.test.ts tests/components/visual-search.test.ts tests/domain/glove-alternatives.test.ts`

Resultado: ambos comandos pasan tras instalar dependencias con `npm.cmd ci`.

## Fase 2 - cobertura live y UX inmediata

Fecha: 2026-10-08

### Implementado

- Se anade `npm run validate:live` para ejecutar una matriz reproducible de 30 consultas dentales contra los 7 proveedores automaticos.
- La matriz distingue `results`, `no_match`, `error` y `partial`; un HTTP no OK ya no se clasifica como ausencia de coincidencias.
- La UI de resultados se simplifica: cada producto muestra sus proveedores inmediatamente, con precio publicado, coste total, precio unitario normalizado cuando es fiable y nivel A/B/C.
- La tabla "Todos los precios encontrados" se alimenta de todos los productos recuperados, incluidos accesorios/relacionados, para que las ofertas no desaparezcan por filtros visuales.
- Los accesorios y relacionados conservan sus proveedores accesibles dentro del panel secundario.

### Validacion externa real

Comando ejecutado:

```bash
npm.cmd run validate:live
```

Resultado guardado en `docs/live-search-matrix.latest.json`.

Resumen de la ejecucion standard:

- Consultas: 30
- Proveedores automaticos por consulta: 7
- Ofertas recuperadas: 22
- Celdas con resultados: 7
- Celdas sin coincidencias: 77
- Celdas con error: 126
- Celdas con limite de candidatos: 0

Lectura tecnica:

- `dvd-dental` y `dentalboom` responden como fuentes ligeras/API.
- `dentaltix`, `dentalcost`, `dentalexpress` y `dentipak` devolvieron HTTP 503 en la ruta live publicada para todas las consultas de la matriz.
- `ortolan` devolvio una mezcla de `no_match` y HTTP 503.
- Una consulta puntual a `dentaltix` para `4910A3B` devolvio `error code: 1102` desde Cloudflare, compatible con limite de CPU del Worker publicado.

Conclusion:

La matriz no permite afirmar ausencia de producto en los proveedores HTML cuando aparece HTTP 503/1102. Se registra como fallo operativo de ejecucion del Worker o del conector, pendiente de optimizacion antes de considerar la cobertura real satisfactoria.

### Validacion local de esta fase

- `npm.cmd run typecheck`
- `npm.cmd test -- tests/components/all-supplier-prices.test.ts tests/domain/universal-search.test.ts tests/components/comparison-table.test.ts`

Resultado: OK.
