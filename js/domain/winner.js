// El "ganador" segun la regla del ejercicio (CLAUDE.md: "gana quien lleve
// esto al menor costo, en menor tiempo"): de los escenarios que SI caben en
// el horizonte de 8 meses sin choques, el de menor costo. Un solo lugar
// para esta regla para que Costos, Programa y Escenarios nunca la calculen
// de formas distintas y se desincronicen.
export function findWinningScenario(evaluations) {
  const feasible = evaluations.filter((e) => e.result.feasible && e.result.withinHorizon);
  if (feasible.length === 0) return null;
  return feasible.reduce((best, e) => (e.result.cost.totalCostMXN < best.result.cost.totalCostMXN ? e : best));
}
