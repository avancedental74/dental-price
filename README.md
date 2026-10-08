# Dental Price

Comparador de coste efectivo de suministros dentales para proveedores que venden y entregan en España.

## Estado

**Buscador federado en vivo desplegado. El catálogo local ya no es requisito para buscar un producto.**

Estado verificado el 07/10/2026:

- La búsqueda principal acepta **nombre o referencia libre** y consulta proveedores en el momento de la búsqueda.
- El Worker no necesita que el producto exista en `data/products.json`: el catálogo local queda para histórico, pruebas y datos auxiliares.
- Cada consulta usa un `sessionId`; solo ofertas obtenidas dentro de esa sesión pueden ganar.
- **7 proveedores permiten búsqueda automática live**: Dentaltix, DentalCost, DVD Dental, Dental Express, Ortolan, Dentipak y Dental Boom.
- **3 proveedores están protegidos por AWS WAF/CAPTCHA** frente a peticiones de servidor: Proclinic, Dental Ibérica y Broker Dental. No se intenta eludir esa verificación; quedan identificados como proveedores que requieren navegación humana.
- Prueba end-to-end confirmada sin depender del catálogo: búsqueda de `4910A3B` en Dentaltix → variante exacta `053M4910A3B` → Filtek Supreme XTE A3 Body 3 g → precio live 44,90 € en la ejecución de verificación.
- DentalCost y Dental Express también devuelven referencias exactas en pruebas live; DVD usa su API pública Klevu y Ortolan sus datos estructurados de búsqueda para evitar cargas pesadas y falsos positivos.
- El smoke test del Worker consulta los siete proveedores live y exige respuestas válidas antes de considerar correcto el despliegue.
- El snapshot programado y su histórico continúan existiendo, pero **no sustituyen a una consulta live** ni pueden declarar el ganador de una búsqueda actual.
- CI completo en verde para el frontend y las reglas de dominio.

## Objetivo

Encontrar el mejor coste efectivo entre los proveedores consultados, considerando identidad real del producto, cantidad, promociones, stock, transporte, frescura e histórico.

> La aplicación nunca debe afirmar que un resultado es “el más barato de España”; únicamente el mejor precio encontrado entre las fuentes consultadas.

## Stack V1

- React
- TypeScript
- Vite
- Zod
- Vitest
- GitHub Actions
- GitHub Pages

Infraestructura de pago: **ninguna prevista en V1**.

## Especificación

La fuente de verdad del proyecto está en `docs/DENTAL_PRICE_MASTER_SPEC.md`.

El estado real y las limitaciones verificadas están en `docs/HARDENING_STATUS.md`.

## Proveedores

1. Dentaltix — búsqueda live por nombre o referencia; variantes exactas recuperadas también desde el payload Nuxt.
2. DentalCost — búsqueda live por nombre o referencia.
3. DVD Dental — búsqueda live mediante su API pública Klevu; no se descarga la página de resultados completa.
4. Dental Express — búsqueda live; referencia del fabricante y referencia interna separadas.
5. Ortolan — búsqueda live usando resultados estructurados de su buscador.
6. Dentipak — búsqueda live con validación de referencia, precio y stock en el smoke test.
7. Dental Boom — búsqueda live mediante API pública de WooCommerce + verificación en ficha.
8. Proclinic — AWS WAF exige verificación humana a las peticiones de servidor.
9. Dental Ibérica — AWS WAF exige verificación humana a las peticiones de servidor.
10. Broker Dental — AWS WAF exige verificación humana a las peticiones de servidor.

## Funciones ya operativas

- Snapshot actual reconstruido desde cero en cada refresh: un fallo de verificación no conserva un precio antiguo como ganador.
- Estados separados de fuente, match y comprabilidad.
- Políticas de portes versionadas fuera de los conectores y **revalidadas automáticamente cada semana** contra las páginas públicas de Dentaltix, DentalCost y DVD Dental; si no se pueden confirmar, no se renueva su vigencia.
- Promociones reales estructuradas; regalos de otro producto se muestran como informativos y no se descuentan como si fueran unidades del mismo SKU.
- Búsqueda ambigua con selección explícita de candidatos.
- Registry central de referencias y presentaciones.
- Basket Optimizer V1: distribuye una cesta entre proveedores considerando promociones, IVA, portes y umbrales; permite **actualizar todas las líneas en vivo antes de optimizar**, reemplaza las ofertas anteriores por la nueva tanda y usa poda + memoización en lugar de producto cartesiano.
- Validación de todo el catálogo contra referencias exactas y referencias contradictorias.

## Principio no negociable

No se inventan equivalencias, IVA, portes, stock ni precios. Un dato incompleto puede mostrarse, pero no ganar la comparación.

## Búsqueda en vivo

La comparación interactiva usa un backend serverless separado del snapshot programado.

- El usuario escribe cualquier nombre o referencia; no se selecciona primero un producto de una base precargada.
- El navegador crea un `sessionId` y lanza consultas independientes a los proveedores live.
- Cada proveedor descubre sus fichas en su propio buscador y extrae el precio actual de esa consulta.
- Solo ofertas obtenidas y verificadas dentro del mismo `sessionId` pueden ganar.
- Las referencias exactas tienen prioridad. Cuando un proveedor no expone referencia de fabricante, el resultado puede mostrarse y agruparse de forma conservadora por nombre + atributos, pero no se inventa una referencia para hacerlo ganador.
- `current-prices.json` es snapshot/histórico y nunca sustituye a una consulta live.
- Si el backend live no está configurado o falla, la aplicación no declara ganador con datos guardados.
- Backend desplegado: Cloudflare Workers; frontend en GitHub Pages.
- El frontend lee el endpoint desde `VITE_LIVE_API_URL`.
- Los despliegues del Worker están serializados para evitar que una ejecución antigua sobrescriba una versión más nueva.
- El smoke test de despliegue exige respuesta válida de Dentaltix, DentalCost, Dental Express, Ortolan, DVD, Dentipak y Dental Boom antes de considerar correcto el despliegue.
