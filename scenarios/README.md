# Escenarios

Decisión de Laisa (2026-08-12): se recortó de los 8 escenarios originales del brief a
solo 3, para no saturar la comparación:

- **actual.json** — headcount de hoy, sin atraso.
- **atraso-40.json** — headcount de hoy, cada fase dura 40% más.
- **Óptimo** — no existe como archivo estático porque depende de calcular contra el
  Excel en vivo (búsqueda greedy del menor headcount que cabe en 8 meses). Se genera
  en código, en `js/domain/scenario-presets.js`.

Estos dos archivos son de referencia/versionado (`git diff` entre ellos). La app trae
estos mismos valores escritos en código en `STATIC_SCENARIOS`, para no depender de un
`fetch()` extra.

Los escenarios que un usuario cree/edite a mano en `recursos.html` viven en
`localStorage` del navegador, y se pueden exportar a un archivo `.json` con este mismo
formato desde `escenarios.html`.
