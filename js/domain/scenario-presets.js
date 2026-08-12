// Los 8 escenarios pedidos en el brief. Los 5 "simples" son objetos
// estaticos (tambien viven como JSON en scenarios/ para diff de git). Los 3
// que requieren calculo contra el modelo (fte minimo viable, mayor ahorro, y
// optimo) se generan en vivo - nunca se guarda un resultado calculado.

import { evaluateScenario } from '../state/store.js';
import { structuralConflicts } from './scheduler.js';
import { headcountByRoleFromScenario, computeWeeklyDemand, detectConflicts } from './conflicts.js';
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
    id: 'escenario-1',
    name: 'Escenario 1',
    description: 'El escenario alterno que ya trae el Excel fuente (5 personas por rol).',
    fteBase: 'Escenario 1',
    fteOverrides: {},
    delayPct: 0,
    maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER,
  },
  {
    schemaVersion: 1,
    id: 'atraso-5',
    name: '+5% de atraso',
    description: 'Headcount Actual, pero cada fase dura 5% mas de lo planeado.',
    fteBase: 'Actual',
    fteOverrides: {},
    delayPct: 5,
    maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER,
  },
  {
    schemaVersion: 1,
    id: 'atraso-10',
    name: '+10% de atraso',
    description: 'Headcount Actual, pero cada fase dura 10% mas de lo planeado.',
    fteBase: 'Actual',
    fteOverrides: {},
    delayPct: 10,
    maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER,
  },
  {
    schemaVersion: 1,
    id: 'menor-ahorro-menor-tiempo',
    name: 'Menor ahorro, menor tiempo',
    description: 'Mismo perfil que Escenario 1: mucha gente contratada (gasto alto), programa corto.',
    fteBase: 'Escenario 1',
    fteOverrides: {},
    delayPct: 0,
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

export function computeMayorAhorroMayorTiempo(model) {
  const base = computeFteMinimoViable(model);
  return {
    ...base,
    id: 'mayor-ahorro-mayor-tiempo',
    name: 'Mayor ahorro, mayor tiempo',
    description: 'El mínimo de gente que hace el programa posible (sin resolver choques por traslape): gasto bajo, programa largo por la serialización forzada.',
  };
}

// Busqueda simple (no es un optimizador matematico): prueba multiplicadores
// de headcount entre Actual y Escenario 1, se queda con el MENOR que logre
// caber en el horizonte de 8 meses sin choques estructurales ni cruzados.
export function computeOptimo(model) {
  const actual = headcountByRoleFromScenario(model, { fteBase: 'Actual' });
  const esc1 = headcountByRoleFromScenario(model, { fteBase: 'Escenario 1' });

  const candidates = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  let winner = null;

  for (const mult of candidates) {
    const overrides = {};
    for (const role of Object.keys(actual)) {
      const scaled = Math.min(esc1[role], Math.ceil(actual[role] * mult));
      overrides[role] = scaled;
    }
    const candidateScenario = {
      id: 'optimo-candidato',
      fteBase: 'Actual',
      fteOverrides: overrides,
      delayPct: 0,
      maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER,
    };
    const result = evaluateScenario(model, candidateScenario);
    if (result.feasible && result.withinHorizon) {
      winner = { mult, overrides, cost: result.cost.totalCostMXN };
      break;
    }
  }

  const fallbackOverrides = winner ? winner.overrides : esc1;

  return {
    schemaVersion: 1,
    id: 'optimo',
    name: 'Óptimo',
    description: winner
      ? `Búsqueda simple (multiplicadores de headcount sobre Actual, tope Escenario 1): el multiplicador ${winner.mult}x fue el menor que cupo en 8 meses sin choques.`
      : 'Ni siquiera Escenario 1 (5 por rol) cupo en 8 meses sin choques - se usa Escenario 1 como mejor disponible.',
    fteBase: 'Actual',
    fteOverrides: fallbackOverrides,
    delayPct: 0,
    maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER,
    searchFoundFeasible: !!winner,
  };
}

export function getAllScenarios(model) {
  return [...STATIC_SCENARIOS, computeFteMinimoViable(model), computeMayorAhorroMayorTiempo(model), computeOptimo(model)];
}
