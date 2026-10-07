# Opportunity Score V1

## Objetivo
Responder de forma determinista a:
> ¿Es buen momento para comprar este producto?

## Escala
- 0–20: muy caro
- 21–40: caro
- 41–60: normal
- 61–80: buen precio
- 81–100: precio excepcional

## Señales usadas
- precio actual vs media 30 días
- precio actual vs media 90 días
- posición entre mínimo y máximo de 90 días
- cercanía al mínimo histórico
- promoción activa
- frescura
- disponibilidad
- confianza según número de observaciones

## Restricción
Con menos de 3 observaciones históricas válidas no se calcula score.
Se devuelve:
> Histórico insuficiente para valorar el momento de compra

## Principio
Una promoción aporta un bonus pequeño. No puede convertir por sí sola un precio objetivamente caro en un gran momento de compra.

## Confianza
El efecto del score se modera cuando hay pocas observaciones. La confianza crece hasta 12 observaciones.

## Salida
El resultado incluye score, etiqueta, motivos y breakdown de cada componente para que sea auditable.