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

## Commits incluidos

- `4df2f61 feat: add live search traceability`
- `35ae7ef feat: add sortable supplier comparison`

## Verificacion local

Ejecutado en Windows, Node/npm local:

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run validate:data
npm.cmd run build
```

Resultado:

- Typecheck: OK
- Lint: OK
- Tests: 50 archivos, 219 tests, OK
- Validacion de datos: OK
- Build Vite: OK

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
- Los precios de indice permanecen como Nivel C y no compiten como ganadores.
- La cobertura real depende de las respuestas publicas de cada proveedor consultado.

## Instrucciones de revision

1. Abrir PR desde `mejora-dental-price-v2` hacia `main`.
2. Confirmar que CI reproduce typecheck, lint, tests, validate:data y build.
3. Revisar visualmente una busqueda por referencia exacta y otra generica.
4. Verificar que las ofertas Nivel C se muestran, pero no aparecen como coste final recomendado.
5. Verificar que la tabla de proveedores ordena correctamente por coste total y fiabilidad.
