# Pricing Engine V1

## Objetivo
Convertir una oferta en coste económico efectivo para una cantidad solicitada.

## Incluye
- cantidad
- salePrice o regularPrice
- descuentos porcentuales
- descuento fijo si se especifica
- promociones buy_x_get_y (3+1, 4+1, etc.)
- IVA conocido
- envío conocido
- umbral de envío gratis
- free shipping promo
- coste efectivo por unidad
- warnings cuando faltan datos

## Regla crítica
Nunca inventar IVA ni portes.

Si falta transporte:
> Transporte no confirmado

Si falta IVA:
> IVA no confirmado

## Definición de coste efectivo
coste efectivo total = subtotal promocional + IVA conocido + transporte conocido

Si IVA o transporte son desconocidos, el cálculo se devuelve con warning y deberá tratarse como estimación incompleta en la UI.

## Promoción 3+1
Para 4 unidades solicitadas y precio 42 €:
- pagadas: 3
- recibidas: 4
- coste: 126 €
- coste unitario efectivo: 31,50 €

## Siguiente integración
El Comparison Engine debe ordenar por effectiveTotalCost cuando el cálculo sea suficientemente comparable.