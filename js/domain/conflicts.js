// Algoritmo 3.2 del plan: demanda semanal de cada rol (sumando todos los
// sitios/fases activos esa semana) contra la oferta (headcount) del
// escenario. El excedente es un choque, con detalle de quien lo causa.

import { rolesForPhase } from './timeline.js';

export function computeWeeklyDemand(model, timelines) {
  const demand = new Map(); // role -> Map(week -> total)
  const demandDetail = new Map(); // role -> Map(week -> [{site, phase, fraction}])

  function addDemand(role, week, fraction, site, phase) {
    if (!demand.has(role)) demand.set(role, new Map());
    if (!demandDetail.has(role)) demandDetail.set(role, new Map());
    const roleDemand = demand.get(role);
    const roleDetail = demandDetail.get(role);
    roleDemand.set(week, (roleDemand.get(week) ?? 0) + fraction);
    if (!roleDetail.has(week)) roleDetail.set(week, []);
    roleDetail.get(week).push({ site, phase, fraction });
  }

  for (const timeline of timelines) {
    if (!timeline.hasResourceData) continue; // cluster sin datos, no se inventa demanda
    for (const phase of timeline.phases) {
      const roleAllocations = rolesForPhase(model, timeline.cluster, phase.name);
      for (let week = phase.startWeek; week < phase.endWeek; week++) {
        for (const { role, capacityConsumption } of roleAllocations) {
          addDemand(role, week, capacityConsumption ?? 0, timeline.site.brewery, phase.name);
        }
      }
      // Fase-hito (0 semanas): igual consume la semana de su arranque, un instante de coordinacion.
      if (phase.isMilestone) {
        for (const { role, capacityConsumption } of roleAllocations) {
          addDemand(role, phase.startWeek, capacityConsumption ?? 0, timeline.site.brewery, phase.name);
        }
      }
    }
  }

  return { demand, demandDetail };
}

export function detectConflicts({ demand, demandDetail }, headcountByRole) {
  const conflicts = [];
  for (const [role, weekMap] of demand.entries()) {
    const supply = headcountByRole[role] ?? 0;
    for (const [week, total] of weekMap.entries()) {
      if (total > supply + 1e-9) {
        conflicts.push({
          role,
          week,
          demand: total,
          supply,
          overage: total - supply,
          contributors: demandDetail.get(role)?.get(week) ?? [],
        });
      }
    }
  }
  return conflicts.sort((a, b) => a.week - b.week || b.overage - a.overage);
}

export function headcountByRoleFromScenario(model, scenario) {
  const map = {};
  for (const pool of model.resourcePools) {
    const base = scenario?.fteBase === 'Escenario 1' ? pool.escenario1Total : pool.actualTotal;
    const override = scenario?.fteOverrides?.[pool.role];
    map[pool.role] = override !== undefined ? Math.max(override, base) : base; // nunca menos que el base
  }
  return map;
}

export function maxFinishWeek(timelines) {
  return timelines.reduce((max, t) => Math.max(max, t.finishWeek), 0);
}

export function buildWeeklyDemandTable(model, timelines, headcountByRole) {
  const { demand } = computeWeeklyDemand(model, timelines);
  const horizon = maxFinishWeek(timelines);
  const roles = model.resourcePools.map((p) => p.role);
  return roles.map((role) => {
    const roleDemand = demand.get(role) ?? new Map();
    const weeks = [];
    for (let w = 0; w < horizon; w++) {
      const d = roleDemand.get(w) ?? 0;
      weeks.push({ week: w, demand: d, supply: headcountByRole[role] ?? 0, overloaded: d > (headcountByRole[role] ?? 0) + 1e-9 });
    }
    return { role, weeks, peakDemand: Math.max(0, ...weeks.map((w) => w.demand)) };
  });
}
