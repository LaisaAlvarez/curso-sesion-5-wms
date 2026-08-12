// Algoritmo 3.3 del plan: heuristica greedy que propone semana de arranque
// por sitio. Es un PUNTO DE PARTIDA editable, no un optimizador matematico.
//
// Distincion importante descubierta al verificar el motor de choques: bajo
// headcount "Actual", un solo sitio YA genera choques el solo (ej.
// Capacitadores: Hipercuidado necesita 3, solo hay 1) - eso es un choque
// ESTRUCTURAL, no depende del calendario. La heuristica solo debe evitar
// choques NUEVOS por traslape entre sitios (choques donde participa mas de
// un sitio), nunca puede "resolver" un choque estructural moviendo semanas.

import { computeSiteTimeline } from './timeline.js';
import { computeWeeklyDemand, detectConflicts } from './conflicts.js';

function isCrossSiteConflict(conflict) {
  const sites = new Set(conflict.contributors.map((c) => c.site));
  return sites.size > 1;
}

export function crossSiteConflicts(conflicts) {
  return conflicts.filter(isCrossSiteConflict);
}

export function structuralConflicts(conflicts) {
  return conflicts.filter((c) => !isCrossSiteConflict(c));
}

function resourceIntensity(model, site, maturity) {
  const timeline = computeSiteTimeline(model, site, { startWeek: 0, maturity });
  let intensity = 0;
  for (const phase of timeline.phases) {
    const roles = timeline.hasResourceData
      ? model.allocations.filter((a) => a.cluster === site.cluster && a.phase === phase.name)
      : [];
    const totalFraction = roles.reduce((s, r) => s + (r.capacityConsumption ?? 0), 0);
    intensity += Math.max(phase.durationWeeks, 1) * totalFraction;
  }
  return intensity;
}

export function proposeSchedule(model, { headcountByRole, maturityByCluster = {}, delayPct = 0, horizonWeeks = 35 } = {}) {
  const sitesOrdered = [...model.sites].sort((a, b) => {
    const ia = resourceIntensity(model, a, maturityByCluster[a.cluster]);
    const ib = resourceIntensity(model, b, maturityByCluster[b.cluster]);
    if (ib !== ia) return ib - ia; // mayor intensidad primero
    return a.brewery.localeCompare(b.brewery);
  });

  const placed = [];
  const startWeekBySite = {};
  const overflowSites = [];
  const MAX_WEEK_SEARCH = horizonWeeks * 3;

  for (const site of sitesOrdered) {
    const maturity = maturityByCluster[site.cluster];
    let chosenWeek = null;
    let bestFallbackWeek = 0;
    let bestFallbackCrossConflicts = Infinity;

    for (let week = 0; week <= MAX_WEEK_SEARCH; week++) {
      const candidate = computeSiteTimeline(model, site, { startWeek: week, maturity, delayPct });
      const testSet = [...placed, candidate];
      const conflicts = detectConflicts(computeWeeklyDemand(model, testSet), headcountByRole);
      const crossConflicts = crossSiteConflicts(conflicts);

      if (crossConflicts.length < bestFallbackCrossConflicts) {
        bestFallbackCrossConflicts = crossConflicts.length;
        bestFallbackWeek = week;
      }

      if (crossConflicts.length === 0 && candidate.finishWeek <= horizonWeeks) {
        chosenWeek = week;
        break;
      }
    }

    if (chosenWeek === null) {
      // No se encontro semana sin choques cruzados dentro del horizonte:
      // se usa la mejor encontrada (menos choques cruzados) y se marca overflow.
      chosenWeek = bestFallbackWeek;
      overflowSites.push(site.brewery);
    }

    const finalTimeline = computeSiteTimeline(model, site, { startWeek: chosenWeek, maturity, delayPct });
    placed.push(finalTimeline);
    startWeekBySite[site.brewery] = chosenWeek;
  }

  return { startWeekBySite, timelines: placed, overflowSites };
}
