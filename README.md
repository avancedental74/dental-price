# Dental Price

Comparador privado de precios de suministros dentales para proveedores que venden y entregan en España.

## Estado

**MVP endurecido y desplegado en GitHub Pages.** El motor de matching, pricing, histórico, anomalías, score, validación y seguridad está operativo.

- Dentaltix: 13 variantes Filtek Supreme XTE verificadas automáticamente.
- Proclinic y Dental Ibérica: sus webs rechazan GitHub Actions; se usa verificación manual segura en el navegador.
- Las ofertas manuales se guardan solo en `localStorage`, exigen URL del proveedor + referencia de fabricante coincidente y conservan histórico local.
- CI completo y auditoría de dependencias con severidad `high` en verde.

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

## Proveedores MVP

1. Dentaltix — automatización pública parcial y validada.
2. Proclinic — snapshot manual local mientras el acceso automatizado siga rechazado.
3. Dental Ibérica — snapshot manual local mientras el acceso automatizado siga rechazado.

## Principio no negociable

No se inventan equivalencias, IVA, portes, stock ni precios. Un dato incompleto puede mostrarse, pero no ganar la comparación.