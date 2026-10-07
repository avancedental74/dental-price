# DENTAL PRICE — MASTER SPEC V1

**Estado:** Aprobado para construcción del MVP  
**Uso:** privado, un único usuario  
**Mercado:** proveedores que vendan y entreguen en España  
**Restricción:** infraestructura gratuita siempre que sea posible  
**Fecha base:** 2026-10-07

## 1. Visión

Dental Price es una herramienta privada de inteligencia de compras para material dental.

Debe responder con trazabilidad a:

> ¿Dónde puedo comprar este producto dental al menor coste efectivo entre los proveedores consultados y es un buen momento histórico para comprarlo?

Nunca debe afirmar “el más barato de España”. Debe mostrar “mejor precio encontrado entre los proveedores consultados”.

## 2. MVP

Debe permitir:

1. Buscar por texto, referencia de fabricante o EAN/GTIN.
2. Identificar un producto canónico.
3. Comparar inicialmente Dentaltix, Proclinic y Dental Ibérica.
4. Mostrar precio, oferta/promoción, stock, transporte conocido, actualización y enlace.
5. Calcular coste efectivo según cantidad.
6. Guardar histórico.
7. Mostrar media 30/90 días, mínimos, máximos y tendencia.
8. Calcular Opportunity Score 0–100 sin IA.
9. Detectar anomalías y excluirlas del ranking.
10. Detectar datos obsoletos.
11. Mostrar salud de conectores.

## 3. No incluido todavía

- multiusuario
- login
- pagos
- pedidos automáticos
- credenciales privadas de proveedores
- facturas
- precios privados negociados
- inventario
- optimización multiproveedor completa
- alertas

## 4. Proveedores iniciales

1. Dentaltix
2. Proclinic
3. Dental Ibérica

Posteriores:
4. DVD Dental
5. DentalCost
6. otros depósitos compatibles

Cada proveedor tendrá un conector independiente.

## 5. Principio de exactitud

La precisión tiene prioridad sobre la cobertura.

Nunca declarar dos artículos idénticos sin evidencia suficiente.

Estados:
- EXACT
- HIGH_CONFIDENCE
- REVIEW_REQUIRED
- REJECTED

## 6. Producto canónico

Campos mínimos:

- id
- manufacturer
- brand
- family
- productName
- variant
- shade
- presentation
- quantity
- unit
- packCount
- manufacturerReference
- eanGtin
- category
- subcategory
- normalizedName
- active

## 7. Matching

Prioridad:

1. EAN/GTIN
2. referencia de fabricante
3. fabricante + familia + variante + presentación + cantidad + pack
4. similitud textual solo como apoyo

Reglas duras de rechazo:
- variante contradictoria
- tono/color contradictorio
- presentación contradictoria
- cantidad incompatible
- pack incompatible
- referencia fabricante contradictoria

Score inicial orientativo:
- EAN exacto +50
- referencia fabricante +40
- fabricante +10
- familia +10
- variante +10
- presentación +10
- cantidad +10
- pack +10

Normalizar a 0–100.

Umbrales iniciales:
- 95–100 EXACT
- 85–94 HIGH_CONFIDENCE
- 70–84 REVIEW_REQUIRED
- <70 REJECTED

Los umbrales deben validarse con ground truth.

## 8. Presentaciones

Nunca tratar automáticamente como mismo SKU:

- jeringa vs cápsulas
- refill vs kit
- unidad vs pack
- 3 g vs 4 g
- 20 cápsulas vs 10 cápsulas
- Body vs Dentin
- A3 vs A3.5
- talla M vs L
- 25 mm vs 31 mm

Se podrá mostrar precio por unidad normalizada sin convertirlos en el mismo SKU.

## 9. Datos de proveedor

Cada oferta debe poder almacenar:

- supplierId
- supplierSku
- manufacturerReference
- eanGtin
- rawName
- normalizedName
- productUrl
- presentation
- quantity
- unit
- packCount
- variant
- shade
- stockStatus
- rawStockText
- regularPrice
- salePrice
- vatIncluded
- vatRate
- currency
- promotion
- shippingCost
- freeShippingThreshold
- deliveryEstimate
- observedAt
- sourceStatus

## 10. Price Engine

No ordenar por precio nominal sin más.

Calcular:

- baseUnitPrice
- promotionalEffectiveUnitPrice
- shippingAllocated
- effectiveUnitCost
- effectiveTotalCost

Conceptualmente:

effectiveTotalCost = productos + portes - descuentos

Las promociones dependen de la cantidad.

## 11. Promociones

Soportar inicialmente:

- percentage_discount
- fixed_discount
- buy_x_get_y
- bundle
- liquidation
- coupon_public
- free_shipping
- other

Ejemplo 3+1:
3 × 42 € = 126 €, 4 unidades recibidas → 31,50 €/unidad efectiva.

## 12. Transporte

Almacenar:

- standardShippingCost
- freeShippingThreshold
- deliveryZone
- deliveryEstimate
- lastVerifiedAt

Si no se conoce: mostrar “Transporte no confirmado”. Nunca inventarlo.

## 13. IVA

Estados:
- included
- excluded
- unknown

No mezclar precios con y sin IVA sin normalización explícita.

## 14. Stock

Estados:
- in_stock
- low_stock
- backorder
- preorder
- unavailable
- unknown

Conservar también el texto original.

## 15. Histórico

No sobrescribir el único precio.

Registrar cambios con:
- productId
- supplierProductId
- observedAt
- regularPrice
- salePrice
- effectivePrice
- promotion
- stockStatus
- shippingCost
- sourceUrl

Si no cambia nada, podrá actualizarse lastSeenAt y seenCount.

## 16. Opportunity Score

Escala 0–100:
- 0–20 muy caro
- 21–40 caro
- 41–60 normal
- 61–80 buen precio
- 81–100 precio excepcional

Variables:
- actual vs media 30 días
- actual vs media 90 días
- distancia al mínimo
- percentil histórico
- promoción
- frescura
- disponibilidad

Sin IA.

## 17. Anomalías

Marcar como suspicious/quarantined:
- 0 €
- negativos
- caída >50 % no explicada
- subida >100 %
- diferencia x10
- cambio brusco de pack/unidad
- desaparición de unidad/presentación

Quarantined nunca puede ganar el ranking.

## 18. Frescura

Inicialmente:
- fresh <24 h
- aging 24–72 h
- stale >72 h

Stale no puede etiquetarse como “mejor precio actual”.

## 19. Conectores

Interfaz lógica:

```ts
interface SupplierConnector {
  search(query: SearchQuery): Promise<SupplierSearchResult[]>;
  fetchProduct(url: string): Promise<SupplierProductRaw>;
  normalize(raw: SupplierProductRaw): SupplierProductNormalized;
  healthCheck(): Promise<ConnectorHealth>;
}
```

Reglas:
- aislados
- tests propios
- fixtures
- versionados
- fallo seguro
- sin evasión de controles
- sin credenciales privadas en V1

## 20. Arquitectura V1

- GitHub
- GitHub Pages
- GitHub Actions
- React
- TypeScript
- Vite
- JSON versionado
- Vitest
- Zod

Sin backend permanente inicialmente.

## 21. Automatización

Workflows previstos:
- test.yml
- refresh-prices.yml
- deploy-pages.yml
- connector-health.yml

Refresh:
1. tests rápidos
2. conectores
3. normalización
4. matching
5. anomalías
6. current prices
7. histórico
8. estado conectores
9. schema validation
10. commit solo si los datos son válidos

## 22. Frontend

Pantalla principal:
- buscador
- cantidad
- identificación de producto

Resultado:
- producto canónico
- mejor opción
- tabla de proveedores
- precio nominal
- coste efectivo
- oferta
- stock
- transporte
- frescura
- enlace
- histórico
- Opportunity Score

## 23. Estructura

```text
docs/
src/
  app/
  components/
  features/
  domain/
  services/
  connectors/
  utils/
  types/
scripts/
data/
fixtures/
tests/
.github/workflows/
```

## 24. Tests obligatorios

Matching:
- misma referencia → match
- distinta variante → reject
- distinto tono → reject
- distinto formato → reject
- distinto pack → reject

Pricing:
- simple
- IVA
- portes
- envío gratis
- cantidad
- %
- 3+1
- packs

Anomalías:
- 0
- negativo
- -90 %
- x10
- cambio unidad

Histórico:
- nueva observación
- idéntica
- cambio precio
- cambio promo
- cambio stock

## 25. Ground truth

Crear `fixtures/validation/ground-truth.json` con 30–50 productos reales y equivalencias verificadas manualmente.

Categorías iniciales:
- composites
- adhesivos
- cementos
- anestesia
- agujas
- guantes
- fresas
- endodoncia
- impresión
- profilaxis
- cirugía
- suturas
- matrices
- desinfección
- consumibles

## 26. Trazabilidad

Todo precio mostrado debe poder explicar:
- proveedor
- URL
- fecha
- producto identificado
- regla de matching
- cálculo de coste efectivo

## 27. IA

La IA podrá sugerir candidatos o sinónimos en fases futuras, pero nunca será autoridad única para declarar que dos productos son idénticos.

## 28. Ranking

Orden:
1. EXACT
2. stock disponible
3. menor coste efectivo
4. dato más reciente
5. entrega como desempate

HIGH_CONFIDENCE se muestra diferenciado.
REVIEW_REQUIRED no compite automáticamente por el primer puesto.

## 29. Seguridad

No almacenar en Pages:
- contraseñas
- tokens privados
- facturas
- datos clínicos
- datos de pacientes
- información financiera sensible

## 30. Criterios de aceptación MVP

El MVP se aprueba solo si:
1. prueba 30–50 productos reales
2. compara 3 proveedores
3. no confunde variantes
4. no confunde packs
5. promociones correctas
6. transporte conocido correcto
7. desconocido marcado
8. histórico funcional
9. estadísticas funcionales
10. anomalías detectadas
11. anomalías excluidas
12. stale excluido como mejor precio actual
13. tests automáticos
14. Actions funcionando
15. Pages funcionando
16. un proveedor caído no rompe otros
17. fecha de actualización visible
18. enlace correcto
19. infraestructura sin coste de pago

## 31. Orden de construcción

1. Bootstrap
2. Modelo de dominio
3. Dentaltix
4. Proclinic
5. Dental Ibérica
6. Matching Engine
7. Pricing Engine
8. Histórico
9. Opportunity Score
10. Frontend final
11. Validation Suite
12. Actions
13. Pages
14. proveedores adicionales

## 32. Regla para Codex

Codex debe:
- seguir este documento
- no cambiar arquitectura sin justificarlo
- no introducir servicios de pago
- no inventar datos
- no asumir equivalencias
- no desactivar tests
- separar dominio y conectores
- no hacer scraping agresivo
- no introducir secretos
- documentar decisiones no contempladas

## 33. Definition of Done

Una tarea está hecha cuando:
1. código implementado
2. tests añadidos
3. tests pasan
4. linter pasa
5. tipos pasan
6. docs actualizadas
7. no rompe conectores
8. salida validada
9. prueba manual mínima
10. commit claro

## 34. Principios no negociables

1. Exactitud antes que cobertura.
2. No inventar precios.
3. No inventar equivalencias.
4. No decir “más barato de España”.
5. Fecha y fuente siempre visibles.
6. Coste efectivo antes que nominal.
7. Promoción dependiente de cantidad.
8. Histórico desde el día uno.
9. Coste 0 € como restricción.
10. Conectores modulares.
11. Tests antes de escalar.
12. Ningún dato privado en Pages.
13. Fallar de forma segura.
