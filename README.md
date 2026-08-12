# Simulador de Rollout WMS

Simulador de decisión para la implementación de un WMS en 15 sitios (7 México, 8 Colombia),
agrupados en 4 clústeres. El reto: cada fase de cada sitio consume capacidad de roles limitados —
si dos sitios avanzan la misma fase al mismo tiempo, compiten por la misma gente. El objetivo es
completar el programa completo en ≤8 meses con el menor costo posible.

Sitio en vivo: https://laisaalvarez.github.io/curso-sesion-5-wms/

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

## Páginas

- `index.html` (portada) — costo total por escenario, desglose de implementación por sitio tal como
  lo pide el brief (dispositivos, montacargas, señalización, etiquetas, 3 opciones de WiFi), nómina
  por rol, retorno de inversión.
- `programa.html` — calendario de los 15 sitios agrupados por país, ruta crítica resaltada. Clic en
  un sitio despliega sus 8 fases con conectores (estilo Gantt de Microsoft Project).
- `recursos.html` — tabla editable de headcount por rol, con demanda semanal en vivo.
- `escenarios.html` — comparativo de Actual, +40% de atraso, y Óptimo; export/import de escenarios propios.
- `informe.html` — resumen ejecutivo en lenguaje llano, con hallazgos y recomendación.
- `datos.html` — explorador de las 6 pestañas del Excel fuente, con advertencias de calidad de datos.

## Hallazgo principal

Con el headcount "Actual" (casi 1 persona por rol), el programa no cabe en 8 meses — se estira a
~118 semanas. El escenario "Óptimo" (búsqueda greedy de headcount, sin techo artificial) sí encuentra
una combinación que cabe en 8 meses sin choques. El detalle y la recomendación completa están en
`informe.html`.

## Estado

Los 8 hitos de construcción están completos (ver historial de commits) y publicados en GitHub Pages.
