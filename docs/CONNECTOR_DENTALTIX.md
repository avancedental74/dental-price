# Dentaltix Connector V1

Primer conector real del proyecto. Procesa fichas públicas de producto sin credenciales.

## Estrategia
1. Fetch HTTP de una ficha concreta.
2. Parseo de JSON-LD cuando existe.
3. Fallback por texto/selectores.
4. Extracción independiente de variantes.
5. Normalización a SupplierOffer.
6. Health check.

## Regla crítica
Una ficha con múltiples variantes no se reduce a un único precio. Cada variante identificable genera una oferta separada.

## Datos soportados
- nombre
- fabricante
- SKU Dentaltix
- referencia fabricante
- precio regular/actual
- disponibilidad textual
- presentación inferida
- cantidad/unidad
- tono
- Body/Dentin/Enamel

## Limitaciones
- Promociones complejas se resolverán en Pricing Engine.
- Algunas variantes dinámicas pueden necesitar extractor adicional.
- No usa login ni evade controles.
- Los fixtures son muestras reducidas, no copias completas de páginas.