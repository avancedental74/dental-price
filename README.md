# Dental Price

Comparador de coste efectivo de suministros dentales para proveedores que venden y entregan en España.

## Estado

**MVP endurecido, desplegado y con comparación automática real entre proveedores.**

Estado verificado el 07/10/2026:

- **93 ofertas automáticas EXACT y normales** en el último refresh publicado.
- **Dentaltix: 42 ofertas automáticas**: 13 Filtek Supreme XTE, 10 Filtek Universal Restorative, 7 Filtek Z250 jeringa, 4 RelyX Universal, 1 Scotchbond Universal Plus, 1 Adper Scotchbond 1XT, 4 tallas de guantes Santex y 2 referencias Peeso 28 mm.
- **DentalCost: 51 ofertas automáticas**: 24 Filtek Supreme XTE, 9 Filtek Universal Restorative, 10 Filtek Z250 jeringa, 4 RelyX Universal, 1 Scotchbond Universal Plus, 1 Adper Scotchbond 1XT y 2 referencias Peeso 28 mm.
- Para referencias compartidas, Dentaltix y DentalCost compiten con precio + IVA + portes + umbral de envío + stock. Ya existe comparación automática real en composites Filtek, endodoncia Peeso, cementos RelyX y adhesivos Scotchbond/Adper.
- **DVD Dental**: página pública accesible, pero la resolución variante→SKU/precio no es fiable desde automatización; se usa snapshot manual seguro.
- **Proclinic y Dental Ibérica**: GitHub Actions recibe HTTP 405; se usa snapshot manual seguro.
- Las ofertas manuales se guardan solo en `localStorage`, exigen dominio del proveedor + referencia de fabricante coincidente y conservan histórico local.
- CI completo y auditoría de dependencias con severidad `high` en verde.
- Todas las peticiones a proveedores tienen timeout de 15 s; una web lenta no puede bloquear todo el refresh.
- El parser de fichas simples de DentalCost ya recupera también disponibilidad; Adper 4242 y Scotchbond 41294 tienen stock confirmado y pueden competir en el ranking.

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

1. Dentaltix — automatización pública activa.
2. DentalCost — automatización pública activa.
3. DVD Dental — conector/health + snapshot manual local mientras no haya datos de variante fiables.
4. Proclinic — snapshot manual local mientras el acceso automatizado siga rechazado.
5. Dental Ibérica — snapshot manual local mientras el acceso automatizado siga rechazado.

## Principio no negociable

No se inventan equivalencias, IVA, portes, stock ni precios. Un dato incompleto puede mostrarse, pero no ganar la comparación.
