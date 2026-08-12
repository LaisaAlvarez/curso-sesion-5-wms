// Algoritmo 3.4 del plan: los sitios no dependen entre si (solo compiten por
// recursos, y un calendario aceptado ya no tiene choques cruzados), asi que
// la fecha fin del programa = el maximo de (semana de arranque + duracion
// total) entre los 15 sitios. Ese sitio (o los que estan a 1-2 semanas del
// maximo) es la ruta critica.

const NEAR_CRITICAL_TOLERANCE_WEEKS = 2;

export function computeCriticalPath(timelines, { tolerance = NEAR_CRITICAL_TOLERANCE_WEEKS } = {}) {
  const programFinishWeek = Math.max(0, ...timelines.map((t) => t.finishWeek));
  const critical = [];
  const nearCritical = [];

  for (const t of timelines) {
    const gap = programFinishWeek - t.finishWeek;
    if (gap === 0) critical.push(t.site.brewery);
    else if (gap <= tolerance) nearCritical.push(t.site.brewery);
  }

  return { programFinishWeek, critical, nearCritical };
}
