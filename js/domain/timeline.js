// Algoritmo 3.1 del plan: linea de tiempo de un sitio = sus 8 fases en
// secuencia (cluster + madurez elegida), con duracion ajustada por delayPct.
// Una fase de 0 semanas es un hito (marcador), no una barra de ancho 0.

import { CONFIG } from '../config.js';

export function getPhaseRowsForClusterMaturity(model, cluster, maturity) {
  return model.phases
    .filter((p) => p.cluster === cluster && p.maturity === maturity)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
}

export function computeSiteTimeline(model, site, { startWeek = 0, maturity, delayPct = 0 } = {}) {
  const effectiveMaturity = maturity ?? CONFIG.DEFAULT_MATURITY_BY_CLUSTER[site.cluster] ?? 'A';
  const phaseRows = getPhaseRowsForClusterMaturity(model, site.cluster, effectiveMaturity);

  let cursor = startWeek;
  const phases = phaseRows.map((row) => {
    const baseWeeks = row.durationWeeks ?? 0;
    const adjustedWeeks = Math.ceil(baseWeeks * (1 + delayPct / 100));
    const phaseStart = cursor;
    const phaseEnd = cursor + adjustedWeeks; // exclusivo
    cursor = phaseEnd;
    return {
      name: row.phase,
      sequence: row.sequence,
      startWeek: phaseStart,
      endWeek: phaseEnd,
      durationWeeks: adjustedWeeks,
      isMilestone: adjustedWeeks === 0,
    };
  });

  return {
    site,
    cluster: site.cluster,
    maturity: effectiveMaturity,
    delayPct,
    startWeek,
    finishWeek: cursor,
    phases,
    hasResourceData: !model.clustersWithoutResourceData.includes(site.cluster),
  };
}

export function computeAllSiteTimelines(model, overridesBySite = {}) {
  return model.sites.map((site) => {
    const o = overridesBySite[site.brewery] ?? {};
    return computeSiteTimeline(model, site, o);
  });
}

export function rolesForPhase(model, cluster, phaseName) {
  if (model.clustersWithoutResourceData.includes(cluster)) return [];
  return model.allocations
    .filter((a) => a.cluster === cluster && a.phase === phaseName)
    .map((a) => ({ role: a.role, capacityConsumption: a.capacityConsumption }));
}
