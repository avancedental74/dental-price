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

## Fase 5 - staging Cloudflare real

Fecha: 2026-10-09

### Despliegue staging

Se autentico Wrangler por OAuth interactivo y se desplego un Worker independiente de produccion:

```bash
npx --yes wrangler@4.45.0 deploy --name dental-price-live-staging
```

URL:

```text
https://dental-price-live-staging.avance-dental74.workers.dev
```

Version final validada:

- `99297a80-867d-41dc-9386-2d9a03a67226`

No se modifico `dental-price-live` de produccion ni GitHub Pages.

### Hallazgo en Cloudflare remoto

La primera matriz staging con el codigo optimizado localmente seguia reproduciendo HTTP 503 / Cloudflare 1102 en proveedores HTML.

Evidencia puntual:

- `Dentaltix`, consulta por nombre `Filtek Supreme XTE A3 Body 3 g`, devolvio `HTTP/1.1 503` con body `error code: 1102`.
- La misma familia puede recuperarse localmente y algunas consultas puntuales pueden funcionar en staging.

Causa confirmada:

- El problema ya no es de acceso remoto al proveedor ni de ausencia de producto.
- Es presupuesto de CPU del Worker remoto al procesar busquedas HTML amplias y/o paginas de ficha pesadas.
- El fallo se produce antes de que el `catch` de la aplicacion pueda devolver JSON, por eso aparece como 503/1102.

### Cambio cloud-safe

Se activo `LIVE_CLOUD_SAFE = "1"` en `wrangler.toml`.

Comportamiento:

- En Cloudflare, proveedores HTML automaticos (`dentaltix`, `dentalcost`, `dentalexpress`, `ortolan`, `dentipak`) solo verifican fichas cuando la consulta parece una referencia/codigo.
- Las busquedas por nombre, marca o descripcion en esos proveedores se clasifican como `partial` con motivo `CLOUD_SAFE_REQUIRES_REFERENCE_OR_LIGHTWEIGHT_API`.
- DVD Dental y DentalBoom siguen usando vias ligeras/API para busquedas por nombre.
- No se inventan precios ni se promueven precios orientativos como confirmados.

Ejemplo controlado:

```text
/search-supplier?q=Filtek%20Supreme%20XTE%20A3%20Body%203%20g&supplier=dentaltix&debug=1
```

Resultado final staging:

- HTTP 200
- `partial: true`
- `error: CLOUD_SAFE_REQUIRES_REFERENCE_OR_LIGHTWEIGHT_API`
- Evento diagnostico: `cloud-safe-skip-html-search`

### Comparacion final de escenarios

Worker antiguo publicado (`docs/live-search-matrix.latest.json`):

- Ofertas: 22
- Celdas con resultados: 7
- Celdas sin coincidencia: 77
- Celdas con error: 126
- Limites de candidatos: 0

Worker local optimizado (`docs/live-search-matrix.worker-local.json`):

- Ofertas: 290
- Candidatos detectados: 379
- Candidatos verificados: 305
- Celdas con resultados: 52
- Celdas con error tecnico: 0
- Limites de candidatos: 74

Worker staging Cloudflare cloud-safe (`docs/live-search-matrix.staging.json`):

- Ofertas: 24
- Candidatos detectados: 25
- Candidatos verificados: 25
- Minimo de candidatos no verificados por limite: 0
- Celdas con resultados: 9
- Celdas sin coincidencia: 55
- Celdas con error tecnico: 0
- Limites de candidatos: 0

Lectura:

- Staging elimina los 503/1102 causados por nuestra aplicacion.
- La cobertura remota en plan gratuito queda limitada para busquedas por nombre en proveedores HTML.
- La cobertura completa local demuestra que el motor y conectores pueden recuperar mas resultados, pero no cabe en el presupuesto remoto actual sin una fuente ligera adicional o backend con mas CPU.
- No se confunden esos limites con productos inexistentes: quedan como `partial`.

### Limitaciones abiertas tras staging

- Para busqueda universal remota por nombre en todos los proveedores HTML hace falta una via ligera adicional: API publica autorizada, indice propio precalculado, cache corta/cola externa o backend con mas CPU.
- DentalCost por nombre sigue siendo ruidoso aunque el acceso por referencia funciona.
- Ortolan requiere discovery mas rico, sin relajar variantes tecnicas.
- Produccion sigue sin actualizarse.

## Fase 6 - arquitectura hibrida de indice incremental

Fecha: 2026-10-09

### Decision de arquitectura

Se separa discovery de verificacion:

- Discovery offline/incremental: `data/live-discovery-index.json`.
- Verificacion live: `/search-supplier` sigue consultando ficha/API concreta para precio actual cuando el presupuesto lo permite.
- El indice no contiene precios y no sustituye la evidencia economica; solo aporta proveedor, URL, referencia, SKU, nombre y atributos tecnicos.
- Si el indice no tiene candidato, el Worker devuelve `partial`, no `no_match`, para no cerrar el catalogo.

### Fuentes del indice

Script:

```bash
npm.cmd run refresh:index
```

Genera el indice desde:

- `data/current-prices.json`: ofertas verificadas previamente.
- `data/price-history.json`: URLs historicas enlazadas a producto canonico.
- `data/supplier-seeds.json`: semillas directas mantenidas.

Resultado inicial:

- Entradas: 359
- Archivo: `data/live-discovery-index.json`

No se incorporan servicios de pago ni credenciales. No se cachean precios como actuales.

### Uso en Worker

Con `LIVE_CLOUD_SAFE=1`:

- DVD Dental y DentalBoom siguen usando APIs/indices ligeros publicos ya existentes.
- Proveedores HTML usan el indice para encontrar URL candidata.
- El Worker verifica una ficha concreta del indice cuando el proveedor y la consulta tienen presupuesto seguro.
- Si hay candidato pero no se puede verificar, responde `partial` con `HYBRID_INDEX_CANDIDATES_NOT_VERIFIED`.
- Si no hay candidato, responde `partial` con `CLOUD_SAFE_REQUIRES_REFERENCE_OR_LIGHTWEIGHT_API`.

Se endurecio `relevantToQuery()`:

- `Body`, `Dentin/Dentina` y `Enamel/Esmalte` son filtros estrictos.
- Cantidades como `3 g` no pueden coincidir con packs `0.2 g`.
- Esto evita que una ficha familiar de Dentaltix mezcle variantes al verificar desde indice.

### GitHub Actions

Implementacion preparada en codigo:

- `package.json` incorpora `npm run refresh:index`.
- El script genera `data/live-discovery-index.json` de forma reproducible.
- Cambio pendiente en workflows: ejecutar `npm run refresh:index` despues de refrescar precios y commitear `data/live-discovery-index.json` junto con datos generados.
- No se subieron cambios en `.github/workflows/*` porque el token remoto actual rechazo el push por falta de scope `workflow`.
- Frecuencia recomendada: diaria (`17 5 * * *`) y manual.

Coste operativo:

- Gratuito dentro de GitHub Actions si se mantiene la frecuencia diaria y el numero de seeds actual.
- Respeta carga razonable: no se anade crawling masivo; el indice deriva de observaciones/semillas ya mantenidas.
- Para ampliar cobertura futura, se debe aumentar semillas o conectores ligeros por lotes pequenos, con pausas y limites por proveedor.

### Matriz staging hibrida

Staging desplegado:

```text
https://dental-price-live-staging.avance-dental74.workers.dev
```

Version validada:

- `7d25b00f-e98c-4090-873a-a22dc7965772`

Matriz final (`docs/live-search-matrix.staging.json`):

- Ofertas: 50
- Candidatos detectados: 37
- Candidatos verificados: 36
- Minimo de candidatos no verificados por limite: 1
- Celdas con resultados: 20
- Celdas sin coincidencia: 55
- Celdas con error tecnico: 0
- Limites de candidatos: 0

Comparacion:

- Produccion antigua: 22 ofertas, 126 errores.
- Staging cloud-safe estricto: 24 ofertas, 0 errores.
- Staging hibrido con indice: 50 ofertas, 0 errores.
- Local optimizado: 290 ofertas, 0 errores, pero con 74 limites de candidatos y coste no apto para Worker gratuito.

Lectura:

- La arquitectura hibrida recupera significativamente mas ofertas que `LIVE_CLOUD_SAFE` estricto sin volver a 503/1102.
- La cobertura sigue por debajo del local porque el indice inicial solo cubre productos observados/semillas.
- La exactitud prima sobre recall: variantes no acreditadas y precios no verificados quedan fuera del ranking.

### APIs e indices publicos observados

- DVD Dental: Klevu publico, util para discovery ligero; precios como Nivel C salvo verificacion de ficha.
- DentalBoom: WooCommerce Store API publica, util para discovery ligero; precios de indice como Nivel C.
- Dentaltix, DentalCost, Dental Express, Dentipak: no se encontro una via ligera suficientemente estable en esta fase; se usa indice incremental y verificacion puntual.
- Ortolan: expone datos estructurados en HTML, pero el discovery por nombre/variante sigue incompleto y costoso en Worker.

### Pendiente

- Ampliar el indice incremental con trabajos offline por lotes pequenos y revisables.
- Investigar endpoints publicos especificos de Dentaltix/DentalCost/Dentipak que no requieran DOM completo.
- Incorporar cache corta por candidato verificado si se confirma que Cloudflare Cache API no compromete frescura ni exactitud.
- Mantener produccion sin cambios hasta revisar PR.
