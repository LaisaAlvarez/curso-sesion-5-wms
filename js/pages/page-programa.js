import { renderNav } from '../ui/nav.js';
import { renderProjectGantt, renderGanttLegend } from '../ui/gantt.js';
import { groupByCountry } from '../ui/country-groups.js';
import { loadWorkbook } from '../data/xlsx-loader.js';
import { buildDomainModel } from '../data/schema.js';
import { evaluateScenario } from '../state/store.js';
import { getAllScenarios } from '../domain/scenario-presets.js';
import { rolesForPhase } from '../domain/timeline.js';
import { CONFIG } from '../config.js';

renderNav('programa.html');
const content = document.getElementById('content');

function countryLabel(country) {
  return country === 'Mexico' ? 'México' : country;
}

function fmtMoney(v) {
  return '$' + Math.round(v).toLocaleString('es-MX');
}

let state = null; // { model, scenarios, scenarioId, expandedSites: Set }

function buildGroups(model, timelines, criticalPath, country) {
  const sitesInCountry = model.sites.filter((s) => s.country === country).map((s) => s.brewery);
  return timelines
    .filter((t) => sitesInCountry.includes(t.site.brewery))
    .sort((a, b) => a.site.brewery.localeCompare(b.site.brewery))
    .map((t) => {
      const isCritical = criticalPath.critical.includes(t.site.brewery);
      const isNearCritical = criticalPath.nearCritical.includes(t.site.brewery);
      let colorClass = '';
      if (isCritical) colorClass = 'status-critical';
      else if (isNearCritical) colorClass = 'status-warning';
      if (!t.hasResourceData) colorClass = 'sin-datos';

      const expanded = state.expandedSites.has(t.site.brewery);
      const children = expanded
        ? t.phases.map((phase) => {
            const roles = t.hasResourceData ? rolesForPhase(model, t.cluster, phase.name) : [];
            const rolesText = t.hasResourceData
              ? roles.map((r) => `${r.role} (${r.capacityConsumption})`).join(', ') || 'sin roles asignados'
              : 'sin datos de recursos';
            return {
              label: `${phase.sequence}. ${phase.name}`,
              startWeek: phase.startWeek,
              endWeek: phase.endWeek,
              milestone: phase.isMilestone,
              colorClass: t.hasResourceData ? '' : 'sin-datos',
              tooltip: `${phase.name}: S${phase.startWeek}–S${phase.endWeek} (${phase.durationWeeks} sem) · ${rolesText}`,
            };
          })
        : [];

      return {
        id: t.site.brewery,
        label: `${t.site.brewery} (clúster ${t.cluster})`,
        startWeek: t.startWeek,
        endWeek: t.finishWeek,
        colorClass,
        expanded,
        tooltip: `${t.site.brewery}: S${t.startWeek}–S${t.finishWeek}${isCritical ? ' (ruta crítica)' : ''} — clic para ${expanded ? 'ocultar' : 'ver'} sus 8 fases`,
        children,
      };
    });
}

function renderDurationHero(criticalPath) {
  const meses = (criticalPath.programFinishWeek / CONFIG.WEEKS_PER_MONTH).toFixed(1);
  return `
    <div class="kpi kpi-wide">
      <div class="label">Duración total del programa</div>
      <div class="dual-value">
        <span class="value">${criticalPath.programFinishWeek}<span class="sub"> semanas</span></span>
        <span class="value">${meses}<span class="sub"> meses</span></span>
      </div>
    </div>
  `;
}

function renderMoneyRow(result) {
  const totalFte = Object.values(result.headcountByRole).reduce((a, b) => a + b, 0);
  const usd = result.cost.totalCostMXN / CONFIG.FX_RATE_MXN_PER_USD;
  const paybackMonths = result.cost.totalMonthlyBenefitMXN > 0 ? result.cost.totalCostMXN / result.cost.totalMonthlyBenefitMXN : null;
  return `
    <div class="kpi-row">
      <div class="kpi"><div class="label">Gente total contratada (FTE)</div><div class="value">${totalFte}</div><div class="sub">suma de todos los roles del escenario</div></div>
      <div class="kpi kpi-hero"><div class="label">Costo total del programa</div><div class="value">${fmtMoney(result.cost.totalCostMXN)}<span class="sub"> MXN</span></div></div>
      <div class="kpi"><div class="label">Costo total (dólares)</div><div class="value">${fmtMoney(usd)}<span class="sub"> USD</span></div></div>
      <div class="kpi">
        <div class="label">Retorno de inversión (ROI)</div>
        <div class="value">${paybackMonths ? paybackMonths.toFixed(1) : '—'}<span class="sub"> meses</span></div>
        <div class="sub">recuperas la inversión con ${fmtMoney(result.cost.totalMonthlyBenefitMXN)} MXN/mes de beneficio</div>
      </div>
    </div>
  `;
}

function renderConflictKpis(result) {
  return `
    <div class="kpi-row">
      <div class="kpi">
        <div class="label">Choques por traslape</div>
        <div class="value ${result.cross.length ? 'status-critical' : 'status-good'}">${result.cross.length}</div>
        <div class="sub">2+ sitios piden el MISMO rol la MISMA semana — sí se arregla moviendo fechas</div>
      </div>
      <div class="kpi">
        <div class="label">Choques estructurales</div>
        <div class="value ${result.structural.length ? 'status-warning' : 'status-good'}">${result.structural.length}</div>
        <div class="sub">un solo sitio, sin competir con nadie, YA no le alcanza la gente — mover fechas no ayuda aquí</div>
      </div>
      <div class="kpi">
        <div class="label">Sitios sin acomodo</div>
        <div class="value">${result.overflowSites.length}</div>
        <div class="sub">sitios que la heurística no logró meter en 8 meses sin choque</div>
      </div>
    </div>
  `;
}

function renderConflictDetail(structural, cross) {
  if (structural.length === 0 && cross.length === 0) {
    return `<div class="warning-item good">Este escenario no tiene ningún choque de recursos — ni estructural ni por traslape.</div>`;
  }
  const parts = [];
  if (structural.length) {
    const byRole = new Map();
    for (const c of structural) {
      if (!byRole.has(c.role)) byRole.set(c.role, { weeks: 0, maxOverage: 0 });
      const e = byRole.get(c.role);
      e.weeks += 1;
      e.maxOverage = Math.max(e.maxOverage, c.overage);
    }
    const items = [...byRole.entries()].map(([role, e]) => `<li><strong>${role}</strong>: falta gente en ${e.weeks} semana(s) — le faltan hasta ${e.maxOverage.toFixed(1)} persona(s) más, aunque esa fase corra sola.</li>`).join('');
    parts.push(`<div class="warning-item alto"><span class="code">Choques estructurales</span><ul>${items}</ul></div>`);
  }
  if (cross.length) {
    const top = cross.slice(0, 6).map((c) => `<li><strong>${c.role}</strong>, semana ${c.week}: se necesitan ${c.demand.toFixed(1)}, solo hay ${c.supply} — compiten: ${[...new Set(c.contributors.map((x) => x.site))].join(' y ')}.</li>`).join('');
    parts.push(`<div class="warning-item alto"><span class="code">Choques por traslape</span><ul>${top}</ul>${cross.length > 6 ? `<p class="text-muted">… y ${cross.length - 6} más (ajusta fechas en la pestaña Recursos).</p>` : ''}</div>`);
  }
  return parts.join('');
}

function render() {
  const { model, scenarios, scenarioId } = state;
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  const result = evaluateScenario(model, scenario);
  const { timelines, criticalPath, structural, cross } = result;

  const countryGroups = groupByCountry(model.sites, 'country');
  const ganttSections = countryGroups
    .map(({ country }) => {
      const groups = buildGroups(model, timelines, criticalPath, country);
      return `
        <div class="country-block ${country === 'Mexico' ? 'mexico' : 'colombia'}">
          <span class="country-label">${countryLabel(country)}</span>
          ${renderProjectGantt({
            groups,
            totalWeeks: Math.max(criticalPath.programFinishWeek, 1),
            weeksPerMonth: CONFIG.WEEKS_PER_MONTH,
            title: `Gantt ${country}`,
          })}
        </div>
      `;
    })
    .join('');

  const criticalSites = criticalPath.critical.join(', ');

  content.innerHTML = `
    <div class="panel" style="display:flex; align-items:center; gap:12px;">
      <label for="scenario-select"><strong>Escenario:</strong></label>
      <select id="scenario-select" style="padding:5px 10px;">
        ${scenarios.map((s) => `<option value="${s.id}" ${s.id === scenario.id ? 'selected' : ''}>${s.name}</option>`).join('')}
      </select>
      <span class="text-muted" style="font-size:12.5px;">${scenario.description}</span>
    </div>

    ${renderDurationHero(criticalPath)}
    ${renderMoneyRow(result)}
    ${renderConflictKpis(result)}

    <h2>Detalle de choques</h2>
    <div class="panel">${renderConflictDetail(structural, cross)}</div>

    <h2>Calendario (clic en un sitio para ver sus 8 fases)</h2>
    <p class="subtitle">
      La barra roja es la <strong>ruta crítica</strong>: ${criticalSites || 'ningún sitio'} es el sitio más lento de todos.
      Como los 15 sitios corren en paralelo (unos se traslapan con otros), el programa completo no termina hasta que
      termina el más lento — adelantar cualquier otro sitio no cambia la fecha final; adelantar ${criticalSites || 'el sitio crítico'}
      sí la cambia. La franja ámbar son sitios a ≤2 semanas de distancia del crítico (podrían volverse la nueva ruta
      crítica con un pequeño cambio).
    </p>
    <div class="panel">
      ${renderGanttLegend([
        { label: 'Ruta crítica', colorClass: 'status-critical' },
        { label: 'Casi crítico', colorClass: 'status-warning' },
        { label: 'Sin datos de recursos', colorClass: 'sin-datos' },
      ])}
      ${ganttSections}
    </div>
  `;

  window.__wmsModel = model;
  window.__wmsResult = result;
}

async function main() {
  try {
    const workbook = await loadWorkbook();
    const model = await buildDomainModel(workbook);
    const scenarios = getAllScenarios(model);
    const optimo = scenarios.find((s) => s.id === 'optimo') ?? scenarios[0];

    state = { model, scenarios, scenarioId: optimo.id, expandedSites: new Set() };

    // Delegacion de eventos: el contenido se re-renderiza completo en cada
    // toggle/cambio, asi que los listeners van en el contenedor estable.
    content.addEventListener('click', (e) => {
      const groupRow = e.target.closest('.gantt-group-row');
      if (!groupRow) return;
      const siteId = groupRow.dataset.groupId;
      if (state.expandedSites.has(siteId)) state.expandedSites.delete(siteId);
      else state.expandedSites.add(siteId);
      render();
    });

    content.addEventListener('change', (e) => {
      if (e.target.id === 'scenario-select') {
        state.scenarioId = e.target.value;
        render();
      }
    });

    render();
  } catch (err) {
    content.innerHTML = `<div class="error-banner">${err.message}</div>`;
    console.error(err);
  }
}

main();
