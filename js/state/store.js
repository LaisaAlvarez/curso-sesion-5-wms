// Punto unico donde un escenario (inputs) se convierte en resultados
// (timelines, choques, ruta critica, costo). Todo lo demas es una funcion
// pura de esto - nunca se guardan resultados calculados, solo inputs.

import { proposeSchedule, crossSiteConflicts, structuralConflicts } from '../domain/scheduler.js';
import { computeWeeklyDemand, detectConflicts, headcountByRoleFromScenario } from '../domain/conflicts.js';
import { computeCriticalPath } from '../domain/criticalpath.js';
import { evaluateCost } from '../domain/cost.js';
import { CONFIG } from '../config.js';

export function evaluateScenario(model, scenario) {
  const headcountByRole = headcountByRoleFromScenario(model, scenario);
  const maturityByCluster = scenario.maturityByCluster ?? CONFIG.DEFAULT_MATURITY_BY_CLUSTER;

  const { timelines, overflowSites, startWeekBySite } = proposeSchedule(model, {
    headcountByRole,
    maturityByCluster,
    delayPct: scenario.delayPct ?? 0,
    horizonWeeks: CONFIG.PROGRAM_HORIZON_WEEKS,
  });

  const allConflicts = detectConflicts(computeWeeklyDemand(model, timelines), headcountByRole);
  const cross = crossSiteConflicts(allConflicts);
  const structural = structuralConflicts(allConflicts);
  const criticalPath = computeCriticalPath(timelines);
  const cost = evaluateCost(model, {
    timelines,
    headcountByRole,
    programFinishWeek: criticalPath.programFinishWeek,
    scenario,
  });

  return {
    scenario,
    headcountByRole,
    timelines,
    overflowSites,
    startWeekBySite,
    allConflicts,
    cross,
    structural,
    criticalPath,
    cost,
    withinHorizon: criticalPath.programFinishWeek <= CONFIG.PROGRAM_HORIZON_WEEKS,
    feasible: structural.length === 0,
  };
}
