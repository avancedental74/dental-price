# Proclinic Connector V1

Conector para fichas públicas de Proclinic.

## Datos observables en las fichas
- marca
- Ref. Proclinic
- Ref. fabricante
- contenido/presentación
- precio web
- precio promocional
- precio con IVA
- entrega
- umbral de envío gratuito
- opciones/modelos por variante

## Reglas
- Cada modelo/referencia se conserva como oferta separada.
- El IVA no se hardcodea: cuando existen precio neto y precio con IVA, se infiere la tasa.
- Si no existen ambos valores, vatStatus queda unknown salvo evidencia explícita.
- No se usa login ni se intenta sortear controles.

## Validación inicial
Fixtures de Filtek Supreme XTE y guantes de nitrilo con múltiples tallas.

## Evidencia web inicial
Las fichas públicas consultadas muestran precios sin IVA y precio con IVA, referencias de fabricante, contenido, entrega 24 h y envío gratuito desde 110 €.