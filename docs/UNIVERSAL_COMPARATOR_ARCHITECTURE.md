# Motor de búsqueda y comparación universal

## Objetivo

Un solo flujo para **cualquier referencia o nombre** introducido en Dental Price:

1. Consultar los proveedores automáticos disponibles en tiempo real (independientemente del tipo de artículo).
2. Mantener grupos de identidad individual y referencias diferenciadas, sin precargar un catálogo para restringir las búsquedas.
3. Presentar **todas las opciones devueltas** y la mejor oferta verificable de cada producto.
4. Generar filtros dinámicos según las características encontradas en las fichas.
5. Explorar opciones de otras marcas sin confundir características similares con equivalencia clínica.
6. Calcular y mostrar los costes efectivos solo cuando el IVA, los portes, el stock y la identidad están suficientemente acreditados.

El motor está en `src/features/search/universal.ts`, la UI común en `src/components/UniversalSearchResults.tsx`. No hay rutas de pantalla separadas para guantes, fresas, implantes, composites o nombres desconocidos.

## Categorías

`ProfileId` proporciona perfiles **opcionales y extensibles**. Solo enriquecen el reconocimiento de atributos y establecen criterios de comparabilidad; la búsqueda, el agrupado, la comprobación de proveedores y la UI se ejecutan igual para todos. La categoría **general** permite explorar cualquier material que no esté cubierto por un perfil.

## Dos comparaciones que NO se deben confundir

- **Por producto exacto:** mejor coste efectivo verificado de una referencia comercial, con detalle de sus depósitos. Funciona para todas las consultas (también con una única coincidencia).
- **Explorar alternativas:** otras referencias y marcas con sus precios visibles. **No se declaran comparables por defecto**. Un ranking cruzado exige reglas verificadas del perfil, filtros completos, datos de envase coherentes, la misma unidad y precio elegible; sin ello se presentan las ofertas de manera informativa, no como “la más barata equivalente”.

El perfil específico para guantes existente solo se reutiliza conceptualmente como un caso permitido de comparación por características estrictas; **no gobierna el buscador**. En composites, implantes, materiales rotatorios y productos genéricos se muestran alternativas sin afirmar equivalencia entre marcas ante ausencia de criterios adecuados. Añadir una nueva familia no debe obligar a crear otra pantalla.

## Limitaciones conocidas y siguientes pasos

- La cantidad de opciones sigue dependiendo de las respuestas reales de los proveedores y de sus límites de consulta. “Todas” se refiere a todos los resultados **recuperados**, no a la totalidad del mercado español.
- Las fichas pueden carecer de atributos normalizados o contradictorios. Quedan indicadas como pendientes, sin un ganador falso.
- Los precios publicados sin IVA o envío confirmados no son costes efectivos completos.
- La normalización por unidad (100 unidades, gramo, mililitro) es un indicador del envase disponible, no una cotización para comprar exactamente esa cantidad.
- Para ampliar la comparabilidad cruzada en productos clínicos se necesitan reglas documentadas de dimensiones, compatibilidades, esterilidad, sistemas y presentaciones, con pruebas por familia.
- Está pendiente comprobar visualmente los resultados reales en el sitio desplegado. No se debe interpretar la CI como validación de cobertura de todos los depósitos.

## Criterios de pruebas

Se prueban consultas de composites, fresas, implantes, guantes, anestésicos y materiales genéricos, filtros de fabricante/tono/presentación, sesiones live, exclusión de atributos inconsistentes y precios normalizados.
