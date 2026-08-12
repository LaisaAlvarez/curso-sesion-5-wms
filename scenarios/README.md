# Escenarios

Estos 5 archivos son los escenarios "simples" del ejercicio, versionados aqui para
poder compararlos con `git diff` entre ellos. La app (`js/domain/scenario-presets.js`)
trae estos mismos 5 escritos en código (`STATIC_SCENARIOS`) para no depender de un
`fetch()` extra, más 3 escenarios que SÍ dependen de calcular contra el Excel en vivo
y por eso no existen como archivo estático:

- **fte-minimo-viable** — cuánta gente hay que agregar (nunca quitar) para que ningún
  sitio, corriendo solo, se quede sin gente en su fase más exigente.
- **mayor-ahorro-mayor-tiempo** — usa el mismo cálculo anterior.
- **optimo** — búsqueda simple del menor headcount que logra caber en 8 meses sin
  choques.

Los escenarios que un usuario cree/edite a mano en `recursos.html` viven en
`localStorage` del navegador, y se pueden exportar a un archivo `.json` con este mismo
formato desde `escenarios.html`.
