# Escenarios

Historial de decisiones de Laisa:
- 2026-08-12: recortó de los 8 escenarios originales del brief a solo 3 (Actual,
  +40% de atraso, Óptimo), para no saturar la comparación.
- 2026-08-12 (mismo día, tras feedback de calificación): restauró +5%/+10% de atraso
  y "Mayor ahorro, mayor tiempo" — los 2 que la calificación señaló como faltantes
  para completar el brief. "Escenario 1" y "Menor ahorro, menor tiempo" seguían fuera
  a propósito.
- 2026-08-12 (mismo día, segunda ronda de calificación): restauró **"Escenario 1"**.
  El brief lo exige explícitamente ("Tanto Actual como Escenario 1 tienen que poder
  cargarse y calcularse") — no era una decisión de diseño opcional, así que el motor
  ya lo soportaba internamente (`fteBase: 'Escenario 1'`) pero no estaba expuesto
  como preset seleccionable. "Menor ahorro, menor tiempo" sigue fuera a propósito.

Archivos estáticos (referencia/versionado, `git diff` entre ellos):
- **actual.json** — headcount de hoy, sin atraso.
- **escenario-1.json** — el escenario alterno que ya trae el Excel fuente (5 personas
  por rol) — requisito explícito del brief.
- **atraso-5.json** / **atraso-10.json** / **atraso-40.json** — headcount de hoy,
  cada fase dura 5% / 10% / 40% más.
- **Mayor ahorro, mayor tiempo** y **Óptimo** — no existen como archivo estático
  porque dependen de calcular contra el Excel en vivo (el primero busca el mínimo
  headcount que hace viable a cada sitio solo; el segundo hace una búsqueda greedy
  del menor headcount que cabe en 8 meses). Ambos se generan en código, en
  `js/domain/scenario-presets.js`.

La app trae los valores estáticos también escritos en código en `STATIC_SCENARIOS`,
para no depender de un `fetch()` extra.

Los escenarios que un usuario cree/edite a mano en `recursos.html` viven en
`localStorage` del navegador Y se descargan automáticamente como archivo `.json` al
guardarlos (un paso menos para versionarlos en este folder). También se pueden
exportar de nuevo desde `escenarios.html` en cualquier momento.
