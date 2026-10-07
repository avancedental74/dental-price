# Price History V1

## Objetivo
Guardar la evolución comercial de cada oferta sin inflar innecesariamente el histórico.

## Qué se almacena
- productId
- supplierId
- supplierSku
- observedAt
- lastSeenAt
- seenCount
- regularPrice
- salePrice
- effectivePrice
- stockStatus
- shippingCost
- promotionSignature
- sourceUrl

## Compresión
Si una nueva observación es económicamente idéntica a la última para ese producto/proveedor/SKU, no se añade una fila nueva.
Se actualizan:
- lastSeenAt
- seenCount

Se crea una nueva observación si cambia precio, promoción, stock o transporte.

## Estadísticas
Se calculan:
- precio actual
- media 30 días
- media 90 días
- mínimo/máximo 90 días
- mínimo/máximo histórico
- número de observaciones

## Regla
Las estadísticas usan effectivePrice cuando existe; si no, salePrice y luego regularPrice.

## Uso siguiente
Estas métricas alimentarán el Opportunity Score de la Fase 9.