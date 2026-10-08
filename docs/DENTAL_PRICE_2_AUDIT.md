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
