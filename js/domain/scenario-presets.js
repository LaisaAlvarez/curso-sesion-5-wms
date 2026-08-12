// Escenarios expuestos (decision de Laisa, 2026-08-12: recortar de los 8
// originales del brief a estos 3, para no saturar la comparacion):
// Actual, +40% de atraso, y Optimo.

import { evaluateScenario } from '../state/store.js';
import { headcountByRoleFromScenario } from './conflicts.js';
import { CONFIG } from '../config.js';

export const STATIC_SCENARIOS = [
  {
    schemaVersion: 1,
    id: 'actual',
    name: 'Actual',
    description: 'Headcount de hoy, sin atraso. Punto de partida real.',
    fteBase: 'Actual',
    fteOverrides: {},
    delayPct: 0,
    maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER,
  },
  {
    schemaVersion: 1,
    id: 'atraso-40',
    name: '+40% de atraso',
    description: 'Headcount Actual, pero cada fase dura 40% mas de lo planeado - un escenario de estres, no un ajuste fino.',
    fteBase: 'Actual',
    fteOverrides: {},
    delayPct: 40,
    maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER,
  },
];

// Familia "FTE agregando gente": nunca quita headcount vs Actual, solo agrega
// lo minimo necesario para resolver los choques ESTRUCTURALES (los que
// existen aunque un solo sitio corra solo). No resuelve choques por traslape.
export function computeFteMinimoViable(model) {
  const actualHeadcount = headcountByRoleFromScenario(model, { fteBase: 'Actual' });
  const overrides = {};

  for (const site of model.sites) {
    if (model.clustersWithoutResourceData.includes(site.cluster)) continue;
    for (const allocation of model.allocations.filter((a) => a.cluster === site.cluster)) {
      const current = overrides[allocation.role] ?? actualHeadcount[allocation.role] ?? 0;
      const needed = Math.ceil((allocation.capacityConsumption ?? 0) - 1e-9);
      if (needed > current) overrides[allocation.role] = needed;
    }
  }

  return {
    schemaVersion: 1,
    id: 'fte-minimo-viable',
    name: 'FTE mínimo viable',
    description:
      'Headcount Actual + lo mínimo agregado (nunca se quita gente) para que NINGÚN sitio, corriendo solo, ' +
      'se quede sin gente en su propia fase más exigente. No resuelve choques por traslape entre sitios.',
    fteBase: 'Actual',
    fteOverrides: overrides,
    delayPct: 0,
    maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER,
  };
}

function tallyOverageByRole(conflicts) {
  const tally = {};
  for (const c of conflicts) {
    tally[c.role] = (tally[c.role] ?? 0) + c.overage;
  }
  return tally;
}

// Busqueda greedy (no es un optimizador matematico exacto, pero SIN techo
// artificial): arranca de FTE minimo viable (resuelve los choques
// estructurales) y despues, mientras no quepa en 8 meses sin choques,
// identifica el ROL que mas esta causando choques POR TRASLAPE (mas
// excedente acumulado) y le agrega headcount a ese rol especificamente -
// nunca a todos por igual - hasta que el calendario quepa. Se detiene si
// llega a MAX_ITERATIONS sin converger (para no colgar el navegador) y lo
// declara honestamente en la descripcion.
export function computeOptimo(model) {
  const fteMinimo = computeFteMinimoViable(model);
  const headcount = headcountByRoleFromScenario(model, { fteBase: 'Actual', fteOverrides: fteMinimo.fteOverrides });

  const MAX_ITERATIONS = 400;
  let iterations = 0;
  let result = evaluateScenario(model, { fteBase: 'Actual', fteOverrides: headcount, delayPct: 0, maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER });

  while (!(result.feasible && result.withinHorizon) && iterations < MAX_ITERATIONS) {
    iterations++;
    const overageByRole = tallyOverageByRole(result.cross.length ? result.cross : result.structural);
    const roles = Object.keys(overageByRole);
    if (roles.length === 0) {
      // No hay a quien culpar (raro: no cabe en horizonte pero sin choques
      // reportados) - sube todos los roles 1 como ultimo recurso.
      for (const role of Object.keys(headcount)) headcount[role] += 1;
    } else {
      const worstRole = roles.reduce((a, b) => (overageByRole[a] >= overageByRole[b] ? a : b));
      const step = Math.max(1, Math.ceil(overageByRole[worstRole] / 4)); // paso mas grande si el excedente es grande
      headcount[worstRole] += step;
    }
    result = evaluateScenario(model, { fteBase: 'Actual', fteOverrides: { ...headcount }, delayPct: 0, maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER });
  }

  const converged = result.feasible && result.withinHorizon;
  const headcountAfterConstruccion = Object.values(headcount).reduce((a, b) => a + b, 0);

  // Fase 2 (poda): la fase 1 sube de a pasos proporcionales, que casi
  // siempre se pasan de lo estrictamente necesario. Aqui se intenta quitar
  // gente de a 1, rol por rol (del mas caro al mas barato, para maximizar
  // el ahorro por cada recorte), sin bajar nunca del piso de FTE minimo
  // viable (eso sigue siendo obligatorio) y sin dejar de caber en 8 meses.
  // Se repite en barridos completos hasta que un barrido entero no logre
  // quitar a nadie mas - eso es el punto de equilibrio de esta heuristica.
  let trimIterations = 0;
  if (converged) {
    const floor = { ...headcountByRoleFromScenario(model, { fteBase: 'Actual', fteOverrides: fteMinimo.fteOverrides }) };
    const rolesByCostDesc = [...model.resourcePools].sort((a, b) => b.blendedMonthlyCostMXN - a.blendedMonthlyCostMXN).map((p) => p.role);

    let improvedInSweep = true;
    while (improvedInSweep) {
      improvedInSweep = false;
      for (const role of rolesByCostDesc) {
        while (headcount[role] > floor[role]) {
          trimIterations++;
          const candidate = { ...headcount, [role]: headcount[role] - 1 };
          const candidateResult = evaluateScenario(model, { fteBase: 'Actual', fteOverrides: candidate, delayPct: 0, maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER });
          if (candidateResult.feasible && candidateResult.withinHorizon) {
            headcount[role] -= 1;
            result = candidateResult;
            improvedInSweep = true;
          } else {
            break;
          }
        }
      }
    }
  }

  const totalHeadcount = Object.values(headcount).reduce((a, b) => a + b, 0);
  const trimmed = headcountAfterConstruccion - totalHeadcount;

  return {
    schemaVersion: 1,
    id: 'optimo',
    name: 'Óptimo',
    description: converged
      ? `Búsqueda greedy en 2 fases: (1) ${iterations} iteración(es) agregando gente SOLO al rol más problemático hasta caber en 8 meses, (2) poda de ${trimIterations} intento(s) que quitó ${trimmed} persona(s) de más (empezando por los roles más caros) sin dejar de cumplir la meta. Headcount final: ${totalHeadcount} personas. No es un óptimo matemático garantizado, es un mínimo local de esta heurística.`
      : `Búsqueda greedy no convergió en ${MAX_ITERATIONS} iteraciones (quedó en ${result.criticalPath.programFinishWeek} semanas, headcount total ${totalHeadcount}) - se muestra el mejor resultado alcanzado, no una certeza de que 8 meses sea imposible.`,
    fteBase: 'Actual',
    fteOverrides: { ...headcount },
    delayPct: 0,
    maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER,
    searchFoundFeasible: converged,
    searchIterations: iterations,
  };
}

export function getAllScenarios(model) {
  return [...STATIC_SCENARIOS, computeOptimo(model)];
}
