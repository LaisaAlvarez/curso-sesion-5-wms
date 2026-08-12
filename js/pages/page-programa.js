import { renderNav } from '../ui/nav.js';
import { renderGanttSVG, renderGanttLegend } from '../ui/gantt.js';
import { groupByCountry } from '../ui/country-groups.js';
import { loadWorkbook } from '../data/xlsx-loader.js';
import { buildDomainModel } from '../data/schema.js';
import { computeWeeklyDemand, detectConflicts, headcountByRoleFromScenario } from '../domain/conflicts.js';
import { proposeSchedule, crossSiteConflicts, structuralConflicts } from '../domain/scheduler.js';
import { computeCriticalPath } from '../domain/criticalpath.js';
import { CONFIG } from '../config.js';

renderNav('index.html');
const content = document.getElementById('content');

function countryLabel(country) {
  return country === 'Mexico' ? 'México' : country;
}

// Nota de diseno: el color de cada barra codifica ESTADO (ruta critica /
// casi critica / sin datos), no pais - el pais ya lo dice la seccion en la
// que vive cada Gantt. Mezclar categoria y estado en el mismo canal de
// color es justo el anti-patron que la guia de datavis pide evitar.
function ganttForCountry(model, timelines, country, criticalPath) {
  const sitesInCountry = model.sites.filter((s) => s.country === country).map((s) => s.brewery);
  const rows = timelines
    .filter((t) => sitesInCountry.includes(t.site.brewery))
    .sort((a, b) => a.site.brewery.localeCompare(b.site.brewery))
    .map((t) => {
      const isCritical = criticalPath.critical.includes(t.site.brewery);
      const isNearCritical = criticalPath.nearCritical.includes(t.site.brewery);
      let colorClass = '';
      if (isCritical) colorClass = 'status-critical';
      else if (isNearCritical) colorClass = 'status-warning';
      if (!t.hasResourceData) colorClass = 'sin-datos';
      return {
        label: `${t.site.brewery} (clúster ${t.cluster})`,
        emphasis: isCritical,
        segments: [
          {
            startWeek: t.startWeek,
            endWeek: t.finishWeek,
            colorClass,
            tooltip: `${t.site.brewery}: S${t.startWeek}–S${t.finishWeek}${isCritical ? ' (ruta crítica)' : ''}`,
          },
        ],
      };
    });
  return rows;
}

function renderKpis({ criticalPath, structural, cross, overflowSites, horizonWeeks }) {
  const meses = (criticalPath.programFinishWeek / CONFIG.WEEKS_PER_MONTH).toFixed(1);
  const dentroDeHorizonte = criticalPath.programFinishWeek <= horizonWeeks;
  return `
    <div class="kpi-row">
      <div class="kpi"><div class="label">Duración total</div><div class="value">${criticalPath.programFinishWeek} sem<span class="sub"> (${meses} meses)</span></div></div>
      <div class="kpi"><div class="label">¿Cabe en 8 meses?</div><div class="value ${dentroDeHorizonte ? 'status-good' : 'status-critical'}">${dentroDeHorizonte ? 'Sí' : 'No'}</div></div>
      <div class="kpi"><div class="label">Sitios en ruta crítica</div><div class="value">${criticalPath.critical.length}</div></div>
      <div class="kpi"><div class="label">Choques por traslape</div><div class="value ${cross.length ? 'status-critical' : 'status-good'}">${cross.length}</div></div>
      <div class="kpi"><div class="label">Choques estructurales</div><div class="value ${structural.length ? 'status-warning' : 'status-good'}">${structural.length}</div></div>
      <div class="kpi"><div class="label">Sitios en overflow</div><div class="value">${overflowSites.length}</div></div>
    </div>
  `;
}

function renderStructuralWarning(structural) {
  if (structural.length === 0) return '';
  const byRole = new Map();
  for (const c of structural) {
    if (!byRole.has(c.role)) byRole.set(c.role, { role: c.role, weeks: 0, maxOverage: 0 });
    const entry = byRole.get(c.role);
    entry.weeks += 1;
    entry.maxOverage = Math.max(entry.maxOverage, c.overage);
  }
  const items = [...byRole.values()].map((r) => `<li>${r.role}: faltante en ${r.weeks} semana(s), déficit máximo de ${r.maxOverage.toFixed(2)} persona(s)</li>`).join('');
  return `
    <div class="warning-item alto" style="margin-bottom:10px;">
      <span class="code">Choques estructurales — no se resuelven moviendo el calendario</span>
      Estos roles no alcanzan ni para UN sitio a la vez con el headcount de este escenario — mover fechas no ayuda,
      hace falta más gente en ese rol:
      <ul>${items}</ul>
    </div>
  `;
}

function renderCrossWarning(cross) {
  if (cross.length === 0) {
    return `<div class="warning-item good">Sin choques por traslape entre sitios en este calendario propuesto.</div>`;
  }
  const top = cross.slice(0, 8).map((c) => `<li>${c.role}, semana ${c.week}: demanda ${c.demand.toFixed(2)} vs oferta ${c.supply} (sitios: ${[...new Set(c.contributors.map((x) => x.site))].join(', ')})</li>`).join('');
  return `
    <div class="warning-item alto">
      <span class="code">Choques por traslape — sí se resuelven ajustando el calendario</span>
      ${cross.length} choque(s) donde 2+ sitios compiten por el mismo rol la misma semana:
      <ul>${top}</ul>
      ${cross.length > 8 ? `<p>… y ${cross.length - 8} más.</p>` : ''}
    </div>
  `;
}

async function main() {
  try {
    const workbook = await loadWorkbook();
    const model = await buildDomainModel(workbook);

    const headcount = headcountByRoleFromScenario(model, { fteBase: 'Actual' });
    const { timelines, overflowSites } = proposeSchedule(model, {
      headcountByRole: headcount,
      maturityByCluster: CONFIG.DEFAULT_MATURITY_BY_CLUSTER,
      horizonWeeks: CONFIG.PROGRAM_HORIZON_WEEKS,
    });

    const allConflicts = detectConflicts(computeWeeklyDemand(model, timelines), headcount);
    const cross = crossSiteConflicts(allConflicts);
    const structural = structuralConflicts(allConflicts);
    const criticalPath = computeCriticalPath(timelines);

    const countryGroups = groupByCountry(model.sites, 'country');
    const ganttSections = countryGroups
      .map(({ country }) => {
        const rows = ganttForCountry(model, timelines, country, criticalPath);
        return `
          <div class="country-block ${country === 'Mexico' ? 'mexico' : 'colombia'}">
            <span class="country-label">${countryLabel(country)}</span>
            ${renderGanttSVG({
              rows,
              totalWeeks: Math.max(criticalPath.programFinishWeek, 1),
              title: `Gantt ${country}`,
              weeksPerMonth: CONFIG.WEEKS_PER_MONTH,
            })}
          </div>
        `;
      })
      .join('');

    content.innerHTML = `
      ${renderKpis({ criticalPath, structural, cross, overflowSites, horizonWeeks: CONFIG.PROGRAM_HORIZON_WEEKS })}
      <p class="subtitle">
        Escenario: <strong>Actual</strong> (headcount de hoy) · Madurez por defecto: A en todos los clústeres ·
        Heurística automática de calendario (ajuste manual disponible en la pestaña Recursos).
        ${overflowSites.length ? `<br/><span class="text-secondary">Sitios que no cupieron sin choque dentro del horizonte: ${overflowSites.join(', ')}.</span>` : ''}
      </p>
      <h2>Choques de recursos</h2>
      <div class="panel">
        ${renderStructuralWarning(structural)}
        ${renderCrossWarning(cross)}
      </div>
      <h2>Gantt del programa</h2>
      <div class="panel">
        ${renderGanttLegend([
          { label: 'Ruta crítica (define la fecha de fin)', colorClass: 'status-critical' },
          { label: 'Casi crítico (≤2 semanas de holgura)', colorClass: 'status-warning' },
          { label: 'Sin datos de recursos', colorClass: 'sin-datos' },
        ])}
        ${ganttSections}
      </div>
    `;

    window.__wmsModel = model;
    window.__wmsSchedule = { timelines, criticalPath, cross, structural };
  } catch (err) {
    content.innerHTML = `<div class="error-banner">${err.message}</div>`;
    console.error(err);
  }
}

main();
