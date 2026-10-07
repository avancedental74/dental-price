# Comparison Engine V1

## Objetivo
Cruzar ofertas normalizadas de Dentaltix, Proclinic y Dental Ibérica contra un producto canónico único.

## Pipeline
1. Recibir producto canónico.
2. Recibir ofertas de todos los conectores.
3. Ejecutar Matching Engine por oferta.
4. Marcar elegibilidad.
5. Excluir conflictos, cuarentena, sin stock y datos stale.
6. Ordenar candidatos EXACT por precio mostrado actual.
7. Mantener rechazados con explicación para auditoría.

## Regla de ranking V1
Por ahora el ranking usa salePrice cuando existe, si no regularPrice.

Esto es deliberadamente provisional: el coste efectivo con promociones, IVA, portes y cantidad se incorpora en Fase 7 (Pricing Engine).

## Elegibilidad
Una oferta compite por el primer puesto solo si:
- match EXACT
- no está quarantined
- no está unavailable
- tiene menos de 72 h
- tiene precio positivo

## Trazabilidad
Cada resultado conserva score, razones y conflictos del matching.

## Mensaje de producto
La UI futura deberá decir:
> Mejor precio encontrado entre los proveedores consultados.

Nunca:
> Más barato de España.