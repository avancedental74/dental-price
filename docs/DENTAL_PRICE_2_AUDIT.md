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

## Fase 3 - estabilizacion del nucleo live 503/1102

Fecha: 2026-10-08

### Causa raiz identificada

1. El Worker publicado respondia `/health`, pero las rutas `/search-supplier` de proveedores con HTML pesado devolvian HTTP 503 o `error code: 1102`.
2. La misma consulta ejecutada localmente contra conectores directos si recuperaba ofertas en Dentaltix, DentalCost, DVD Dental, Dentipak y DentalBoom.
3. El Worker local por HTTP, con el codigo actual, recupera tambien Dentaltix y DentalCost sin 503/1102.
4. Por tanto, los 503/1102 de la evidencia inicial no acreditan ausencia de catalogo; son fallo de ejecucion del Worker publicado/codigo desplegado anterior y coste de parsing HTML.
5. No se pudo desplegar staging remoto porque Wrangler exige `CLOUDFLARE_API_TOKEN` en este entorno. Se hizo `wrangler deploy --dry-run` y `wrangler dev --local`.

### Optimizaciones y correcciones

- `src/connectors/live-search.ts`: ruta rapida por regex para extraer enlaces antes de cargar Cheerio en paginas grandes.
- `worker/live-api.ts`: diagnostico estructurado opcional con `debug=1`, eventos por `fetch`, estado HTTP, proveedor, etapa y tiempos.
- `worker/live-api.ts`: `searchOneSupplier` exportado para diagnostico local controlado.
- `worker/live-api.ts` y `src/services/live-prices.ts`: estado `partial` separado de `error` y `no_match`.
- `scripts/live-provider-diagnostics.ts`: diagnostico de 7 consultas representativas, una por proveedor.
- `scripts/live-search-matrix.ts`: HTTP no OK queda como `error`; candidatos sin precio verificable quedan como `partial`.
- `src/connectors/dentalexpress/index.ts`: Dental Express recupera precio orientativo desde `productDetail` cuando el bloque B2B oculta el precio visible; se marca `sourceStatus: suspicious` y `priceVerification: search_index`, por tanto Nivel C.

### Diagnostico individual

Consulta representativa local (`npm.cmd run diagnose:live`):

- Dentaltix `4910A3B`: 1 oferta, ficha y precio verificados, sin error.
- DentalCost `4910A3B`: 1 oferta, ficha y precio verificados, sin error.
- DVD Dental `4910A3B`: 1 oferta desde API Klevu/indice, sin error.
- Dental Express `41294`: 1 oferta Nivel C; precio oculto en bloque B2B y disponible solo como dato de analitica, no checkout/ficha visible.
- Ortolan `Tetric EvoCeram A3,5 Dentina`: sin error, sin coincidencia en esa consulta.
- Dentipak `41294`: 1 oferta, ficha accesible, sin error.
- DentalBoom `Scotchbond Universal Plus`: 1 oferta desde API WooCommerce, sin error.

### Comparacion de metricas

Matriz previa contra Worker publicado (`docs/live-search-matrix.latest.json`):

- Ofertas: 22
- Celdas con resultados: 7
- Celdas sin coincidencias: 77
- Celdas con error: 126
- Limites de candidatos: 0

Matriz posterior contra Worker local HTTP (`docs/live-search-matrix.worker-local.json`):

- Ofertas: 147
- Celdas con resultados: 50
- Celdas sin coincidencias: 107
- Celdas con error tecnico: 0
- Celdas con limite de candidatos: 94

Lectura:

- Los errores HTTP 503/1102 no se reproducen con el codigo actual en Worker local.
- Quedan muchos `candidateLimitReached`, lo que indica que la busqueda amplia encuentra mas candidatos de los que el presupuesto actual decide verificar.
- Los parciales restantes son candidatos sin precio/identidad verificable, no fallos de infraestructura ni productos inexistentes.

### Validaciones ejecutadas

- `npx --yes wrangler@4.45.0 deploy --dry-run --outdir .wrangler-dry-run`
- `npx --yes wrangler@4.45.0 dev --local --port 8787`
- HTTP local con `debug=1` por proveedor.
- `npm.cmd run diagnose:live`
- `LIVE_API_URL=http://127.0.0.1:8787 LIVE_MATRIX_OUT=docs/live-search-matrix.worker-local.json npm.cmd run validate:live`

### Limitaciones pendientes

- No se ha sustituido el Worker de produccion.
- No se ha podido desplegar staging remoto por ausencia de `CLOUDFLARE_API_TOKEN`.
- Ortolan requiere mas trabajo de discovery para algunas consultas por nombre/variante.
- DentalCost encuentra pocos resultados en busquedas genericas: no es caida HTTP, sino candidatos que no pasan verificacion.
- Dental Express mantiene precios como Nivel C cuando proceden de datos no visibles de analitica/B2B.

## Fase 4 - preparacion staging y exploracion progresiva

Fecha: 2026-10-08

### Estado de autenticacion Cloudflare

Comando ejecutado:

```bash
npx --yes wrangler@4.45.0 whoami
```

Resultado:

- Wrangler esta instalado y operativo.
- No hay sesion autenticada: `You are not authenticated. Please run wrangler login`.
- No se ha desplegado staging remoto ni produccion.

Comandos preparados para cuando exista autorizacion interactiva:

```bash
npx --yes wrangler@4.45.0 login
npx --yes wrangler@4.45.0 whoami
npx --yes wrangler@4.45.0 deploy --name dental-price-live-staging
$env:LIVE_API_URL="https://dental-price-live-staging.<subdominio-cuenta>.workers.dev"
$env:LIVE_MATRIX_OUT="docs/live-search-matrix.staging.json"
npm.cmd run validate:live
```

No se debe sustituir `dental-price-live` ni publicar GitHub Pages hasta revisar la matriz staging.

### Cambios implementados

- `src/connectors/live-search.ts`: `discoverSupplierProductUrls` ahora sondea `maxResults + 1` y devuelve `candidateCount` y `candidateLimitReached` sin mostrar el candidato extra.
- `worker/live-api.ts`: presupuesto progresivo para proveedores HTML:
  - referencia exacta: mas candidatos que una busqueda generica;
  - DentalCost: presupuesto superior porque su ranking publico es ruidoso;
  - modo `extended`: presupuesto mayor, siempre acotado.
- `worker/live-api.ts`: la respuesta live incluye `candidateCount` y `verifiedCandidateCount`.
- `src/services/live-prices.ts` y UI: la cobertura conserva candidatos vistos/verificados para auditoria.
- `scripts/live-search-matrix.ts`: la matriz mide candidatos totales, candidatos verificados y minimo de candidatos no verificados.
- `tests/connectors/live-search.test.ts`: regresion para garantizar que el candidato extra de medicion no se devuelve como resultado.

### Matriz comparativa

Worker publicado antiguo (`docs/live-search-matrix.latest.json`):

- Ofertas: 22
- Celdas con resultados: 7
- Celdas sin coincidencia: 77
- Celdas con error: 126
- Limites de candidatos: 0

Worker local optimizado fase 3:

- Ofertas: 147
- Celdas con resultados: 50
- Celdas sin coincidencia: 107
- Celdas con error tecnico: 0
- Limites de candidatos: 94

Worker local optimizado fase 4 (`docs/live-search-matrix.worker-local.json`):

- Ofertas: 290
- Candidatos detectados dentro del sondeo acotado: 379
- Candidatos verificados: 305
- Minimo de candidatos no verificados por limite: 74
- Celdas con resultados: 52
- Celdas sin coincidencia: 107
- Celdas con error tecnico: 0
- Limites de candidatos: 74

Lectura:

- La exploracion progresiva mejora de 147 a 290 ofertas sin reintroducir HTTP 503/1102 en Worker local.
- Los limites bajan de 94 a 74 celdas, pero siguen siendo relevantes; aumentar mas el presupuesto probablemente tensionaria el Worker gratuito y a algunos proveedores.
- La mejora procede sobre todo de verificar mas variantes/ofertas en candidatos ya descubiertos; los precios orientativos se mantienen como Nivel C y no se promocionan como checkout confirmado.

### DentalCost

Evidencia:

- Por referencia exacta (`4910A3B`, `41294`) DentalCost devuelve un unico candidato correcto y se verifica.
- Por nombre amplio (`Filtek Supreme XTE A3 Body 3 g`, `adhesivo universal dental`, `guantes nitrilo talla M sin polvo`) el buscador publico devuelve cientos o miles de resultados poco relacionados en las primeras posiciones.
- No se han convertido esos candidatos ruidosos en equivalencias; se verifican y, si no coinciden con la consulta, quedan como `partial`.

Causa probable:

- Limitacion/ranking del buscador remoto de DentalCost, no caida HTTP ni parser de ficha.

Pendiente:

- Investigar una via publica mas precisa para DentalCost, por ejemplo endpoint interno autorizado o parametros de busqueda mas estrictos, antes de ampliar mas el presupuesto.

### Ortolan

Evidencia:

- `Tetric EvoCeram` devuelve variantes desde detalle.
- `Tetric EvoCeram A3,5 Dentina` no devuelve oferta porque las variantes publicadas localizadas no acreditan `Dentina`; aceptar la coincidencia sin ese atributo mezclaria variantes.
- Consultas genericas como `composite fluido A2` o `sutura seda 3/0` no generan registros en el conector actual.

Causa probable:

- El conector de Ortolan funciona para familias/variantes localizables, pero la cobertura por nombre generico y atributos de variante es incompleta.

Pendiente:

- Mejorar discovery de Ortolan sin relajar atributos tecnicos como dentina/esmalte, talla, tono o formato.
