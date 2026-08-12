# Simulador de Rollout WMS

Simulador de decisión para la implementación de un WMS en 15 sitios (7 México, 8 Colombia),
agrupados en 4 clústeres. El reto: cada fase de cada sitio consume capacidad de roles limitados —
si dos sitios avanzan la misma fase al mismo tiempo, compiten por la misma gente. El objetivo es
completar el programa completo en ≤8 meses con el menor costo posible.

Sitio en vivo: _(pendiente de publicar en GitHub Pages)_

## Cómo correrlo localmente

Este proyecto es HTML/CSS/JS plano, sin paso de compilación (sin Node/npm, sin Python). Pero
**no se puede abrir `index.html` con doble clic** — los navegadores bloquean `fetch()` de
archivos locales (`file://`) por CORS, y la app necesita leer `docs/wms-scenarios-s5 (traducido).xlsx`
en cada carga de página. Hay que servirlo con un servidor local:

```powershell
powershell -File tools/serve.ps1
```

Y abrir `http://localhost:8080/` en el navegador.

## Estructura

- `docs/` — el Excel fuente (datos, sin modificar) y la documentación del brief.
- `js/data/` — carga y normalización de los datos del Excel.
- `js/domain/` — la lógica del problema: calendario, choques de recursos, ruta crítica, costos.
- `js/state/` — estado central y persistencia de escenarios.
- `js/ui/` — componentes de interfaz reutilizables (Gantt, tablas, agrupación por país).
- `js/pages/` — un controlador por página.
- `scenarios/` — los escenarios nombrados del ejercicio, versionados en git.
- `CLAUDE.md` / `CLAUDE.local.md` — el brief del curso y notas de contexto.

## Estado

Proyecto en construcción por hitos incrementales (ver historial de commits). Hito actual:
carga de datos + explorador de las 6 pestañas (`datos.html`) con detección de advertencias de
calidad de datos.
