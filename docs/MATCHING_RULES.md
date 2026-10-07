# Matching Rules V1

## Objetivo

Evitar falsos positivos al comparar ofertas de proveedores con productos canónicos.

## Prioridades

1. EAN/GTIN
2. Referencia fabricante
3. Variante
4. Tono/color
5. Presentación
6. Cantidad + unidad
7. Pack count
8. Familia / texto normalizado

## Regla de rechazo

Una contradicción explícita en referencia, EAN, variante, tono, presentación, cantidad o pack provoca `REJECTED`.

## Compatibilidad de fabricante

En V1 se normaliza 3M → Solventum para evitar falsos negativos en productos migrados de marca corporativa.

## Estados

- EXACT: 95–100 sin conflictos
- HIGH_CONFIDENCE: 85–94 sin conflictos
- REVIEW_REQUIRED: 70–84 sin conflictos
- REJECTED: <70 o conflicto duro

## Restricción

La similitud textual por sí sola nunca convierte un candidato ambiguo en EXACT.
