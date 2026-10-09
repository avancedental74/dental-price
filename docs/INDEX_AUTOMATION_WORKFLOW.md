# Automatizacion del indice incremental

Fecha: 2026-10-09

## Estado

El codigo de discovery incremental esta implementado y validado localmente:

```bash
npm run discover:index
npm run validate:data
```

`discover:index` consulta fuentes publicas autorizadas con limites conservadores, actualiza `data/discovery-source-state.json` y regenera `data/live-discovery-index.json`.

No se ha podido subir una modificacion en `.github/workflows/*` desde esta sesion porque GitHub rechazo el push con:

```text
refusing to allow a Personal Access Token to create or update workflow `.github/workflows/deploy-live-api.yml` without `workflow` scope
```

No se han introducido credenciales en codigo ni archivos versionados.

## Cambio recomendado en GitHub Actions

Cuando exista autorizacion con scope `workflow`, anadir `data/discovery-source-state.json` y `data/live-discovery-index.json` al workflow que refresca datos.

Bloque recomendado dentro del job de refresh, despues de `npm run refresh`:

```yaml
- name: Refresh public data and discovery index
  run: |
    npm run refresh
    npm run discover:index
    npm run validate:data
```

Incluir ambos archivos en la deteccion de cambios y commit:

```bash
git status --porcelain -- \
  data/current-prices.json \
  data/price-history.json \
  data/connector-status.json \
  data/metrics.json \
  data/discovery-source-state.json \
  data/live-discovery-index.json

git add \
  data/current-prices.json \
  data/price-history.json \
  data/connector-status.json \
  data/metrics.json \
  data/discovery-source-state.json \
  data/live-discovery-index.json
```

## Propagacion al Worker

Opcion actual recomendada:

1. El workflow de discovery actualiza y commitea el indice JSON.
2. El workflow de Worker se dispara cuando cambian `data/discovery-source-state.json` o `data/live-discovery-index.json`.
3. Se despliega primero staging.
4. Se ejecutan smoke tests contra staging.
5. Produccion se mantiene manual hasta aprobacion.

El workflow de despliegue deberia incluir estos paths:

```yaml
paths:
  - "worker/**"
  - "src/connectors/**"
  - "src/domain/**"
  - "data/live-discovery-index.json"
  - "data/discovery-source-state.json"
  - "wrangler.toml"
```

## Reversion

Reversion simple con indice versionado:

```bash
git revert <commit-del-indice>
```

Despues se redepliega staging y, solo con aprobacion, produccion.

## Permisos necesarios

- GitHub token o sesion OAuth con scope `workflow` para modificar `.github/workflows/*`.
- Wrangler OAuth ya verificado para staging con permisos `workers_scripts:write`.
- No se requiere token versionado en el repositorio.
