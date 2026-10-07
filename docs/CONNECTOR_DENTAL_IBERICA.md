# Dental Ibérica Connector V1

Conector para fichas públicas de Dental Ibérica.

## Estructura observada
Las fichas publican una tabla o bloque repetido por variante con:
- Ref. propia
- Ref. fabricante
- nombre
- precio
- disponibilidad

## Casos cubiertos
- tonos de composites (A1, A3, A3.5, etc.)
- sabores (Air-N-Go)
- números/tamaños de instrumental (Peeso No1/No2/No3)
- variantes sin stock

## Reglas
- Cada Ref. fabricante se conserva como SKU distinto.
- Un producto sin stock no se elimina: se conserva con stockStatus=unavailable.
- El IVA queda unknown si la página no ofrece evidencia suficiente.
- No se usa login ni se sortean controles.

## Fuentes iniciales verificadas
- Filtek Z250 Cápsula 20 x 0,2 g
- Bicarbonato AIR-N-GO Classic 4 x 250 g
- Fresa Largo Peeso 28 mm 6 uds
- Cubetas flúor dobles 50 uds
- Plancha termoformable 125 x 125 mm