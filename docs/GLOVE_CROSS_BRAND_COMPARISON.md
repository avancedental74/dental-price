# Comparación de guantes entre marcas

## Dos modalidades independientes

1. **Misma referencia exacta:** se mantiene el comparador con identificación estricta por referencia/EAN y validaciones actuales.
2. **Alternativas por características:** sólo para la categoría guantes. Presenta marcas distintas que coinciden con los filtros seleccionados de material, talla, polvo y esterilidad. El color y la cantidad por caja pueden afinar la búsqueda. Coincidencia de características **no constituye equivalencia clínica ni reglamentaria**.

## Costes normalizados por 100 unidades

Se calcula para una caja comprada en la consulta actual:

```
coste efectivo por 100 = round(100 * coste efectivo de 1 envase / unidades verificadas del envase, 2)
```

El coste del envase incorpora IVA y transporte si son verificables. Se usa `calculatePricing` mediante `compareSupplierOffers`; no se implementa un motor paralelo de IVA o portes. La tarifa por 100 es una magnitud normalizada, **no el coste de pedir exactamente 100 unidades** (especialmente con cajas de 50/200 o gastos fijos de envío). Las promociones pueden depender de cantidades mayores.

## Barreras antes de ordenar

- Los cuatro filtros material, talla, polvo y esterilidad deben estar seleccionados. No se supone que un campo ausente tenga un valor por defecto.
- Los productos sin identificador, stock, vigencia, precio, IVA o portes suficientes para superar `compareSupplierOffers` (estado EXACT, sesión live, demás reglas) no entran en el ranking.
- La cantidad del envase se obtiene de la ficha/denominación y se contrasta con `offer.quantity` cuando indica unidades por envase. Si no es verificable o hay contradicción, no se ordena.
- Las ofertas con atributos contradictorios o sin URL HTTPS verificada se excluyen.
- Los resultados proceden únicamente de los proveedores que hayan respondido a la consulta. No se declara un ganador de todo el mercado español.

## Alcance conocido

La consulta genérica «guantes» puede devolver pocos candidatos por los límites de búsqueda de cada proveedor. Las marcas con atributos no publicados o precios inaccesibles quedan como resultados pendientes de verificación, no como ofertas de coste comparable. La verificación visual en la web publicada y las pruebas con datos reales siguen siendo necesarias.
