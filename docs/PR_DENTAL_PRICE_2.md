# PR: Dental Price 2.0 - trazabilidad y comparador

## Resumen

- Anade trazabilidad explicita a la busqueda live:
  - `identityLevel`
  - `identityReasons`
  - `LiveDiscoveryRecord`
- Separa mejor identidad exacta, coincidencia probable e identidad insuficiente.
- Introduce niveles economicos A/B/C en ofertas universales:
  - Nivel A: precio de compra contrastado y elegible.
  - Nivel B: precio de ficha sin condiciones completas para ranking.
  - Nivel C: precio orientativo de indice/busqueda.
- Muestra evidencia de identidad en la pantalla de resultados.
- Anade ordenacion en la tabla comparativa por:
  - fiabilidad
  - coste total
  - precio publicado
  - proveedor
  - disponibilidad
- Documenta auditoria inicial en `docs/DENTAL_PRICE_2_AUDIT.md`.
- Anade diagnostico live por proveedor y matriz reproducible de 30 consultas.
- Corrige la clasificacion de estados `partial` para candidatos sin precio verificable.
- Optimiza discovery HTML con extraccion ligera antes de Cheerio.
- Recupera Dental Express como Nivel C cuando el precio solo aparece en datos no visibles de analitica/B2B.

## Commits incluidos

- `4df2f61 feat: add live search traceability`
- `35ae7ef feat: add sortable supplier comparison`
- `1569827 feat: validate live coverage and simplify results`

## Verificacion local

Ejecutado en Windows, Node/npm local:

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run validate:data
npm.cmd run build
npm.cmd run diagnose:live
```

Resultado:

- Typecheck: OK
- Lint: OK
- Tests: 50 archivos, 220 tests, OK
- Validacion de datos: OK
- Build Vite: OK
- Diagnostico live local: 6 de 7 proveedores con oferta representativa; Ortolan sin coincidencia en la consulta elegida, sin error tecnico.

## Metricas de datos validadas

- Productos: 74
- Ofertas actuales: 98
- Historico: 373 observaciones
- Ground truth: 36 casos
- False exact: 0

## Limites no modificados

- No se eluden WAF/CAPTCHA de Proclinic, Dental Iberica ni Broker Dental.
- No se migra historico a D1 ni a otro almacenamiento central.
- No se despliega Worker ni GitHub Pages desde esta rama.
- No se pudo desplegar staging remoto porque falta `CLOUDFLARE_API_TOKEN`; se valido con Wrangler local.
- Los precios de indice permanecen como Nivel C y no compiten como ganadores.
- La cobertura real depende de las respuestas publicas de cada proveedor consultado.

## Instrucciones de revision

1. Abrir PR desde `mejora-dental-price-v2` hacia `main`.
2. Confirmar que CI reproduce typecheck, lint, tests, validate:data y build.
3. Revisar visualmente una busqueda por referencia exacta y otra generica.
4. Verificar que las ofertas Nivel C se muestran, pero no aparecen como coste final recomendado.
5. Verificar que la tabla de proveedores ordena correctamente por coste total y fiabilidad.
