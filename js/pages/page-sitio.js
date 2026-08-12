import { renderNav } from '../ui/nav.js';
import { renderGanttSVG } from '../ui/gantt.js';
import { loadWorkbook } from '../data/xlsx-loader.js';
import { buildDomainModel } from '../data/schema.js';
import { computeSiteTimeline, rolesForPhase } from '../domain/timeline.js';
import { CONFIG } from '../config.js';

renderNav('sitio.html');

const content = document.getElementById('content');

function fmtNum(v) {
  if (v === null || v === undefined) return '-';
  return typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : v;
}

function countryClass(country) {
  if (country === 'Mexico' || country === 'México') return 'mexico';
  if (country === 'Colombia') return 'colombia';
  return '';
}

function siteOptions(model, selectedBrewery) {
  const groups = new Map();
  for (const s of model.sites) {
    if (!groups.has(s.country)) groups.set(s.country, []);
    groups.get(s.country).push(s);
  }
  return [...groups.entries()]
    .map(
      ([country, sites]) => `
      <optgroup label="${country}">
        ${sites
          .map((s) => `<option value="${s.brewery}" ${s.brewery === selectedBrewery ? 'selected' : ''}>${s.brewery} (clúster ${s.cluster})</option>`)
          .join('')}
      </optgroup>`
    )
    .join('');
}

function renderProfileCard(site) {
  return `
    <div class="panel">
      <div class="kpi-row">
        <div class="kpi"><div class="label">País</div><div class="value">${site.country}</div></div>
        <div class="kpi"><div class="label">Clúster</div><div class="value">${site.cluster}</div></div>
        <div class="kpi"><div class="label">Capacidad (Mio HL)</div><div class="value">${fmtNum(site.capacityMioHL)}</div></div>
        <div class="kpi"><div class="label">Producción (Mio HL)</div><div class="value">${fmtNum(site.productionMioHL)}</div></div>
        <div class="kpi"><div class="label"># Almacenes</div><div class="value">${fmtNum(site.warehouseCount)}</div></div>
        <div class="kpi"><div class="label">Torre de Control</div><div class="value">${site.controlTower ? 'Sí' : 'No'}</div></div>
      </div>
    </div>
  `;
}

function renderPhaseDetailTable(model, timeline) {
  const rows = timeline.phases
    .map((phase) => {
      const roles = timeline.hasResourceData ? rolesForPhase(model, timeline.cluster, phase.name) : [];
      const rolesText = timeline.hasResourceData
        ? roles.map((r) => `${r.role} (${fmtNum(r.capacityConsumption)})`).join(', ') || 'sin roles asignados'
        : 'sin datos de recursos (clúster sin filas en Asignación de Recursos por Fase)';
      return `
        <tr>
          <td>${phase.sequence}</td>
          <td>${phase.name}${phase.isMilestone ? ' (hito)' : ''}</td>
          <td>S${phase.startWeek} – S${phase.endWeek}</td>
          <td>${phase.durationWeeks}</td>
          <td>${rolesText}</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="table-scroll">
      <table>
        <thead><tr><th>#</th><th>Fase</th><th>Semanas</th><th>Duración</th><th>Roles que consume</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderSite(model, brewery) {
  const site = model.sites.find((s) => s.brewery === brewery);
  const timeline = computeSiteTimeline(model, site);
  const cls = countryClass(site.country);

  const ganttRows = timeline.phases.map((phase) => ({
    label: `${phase.sequence}. ${phase.name}`,
    segments: [
      {
        startWeek: phase.startWeek,
        endWeek: phase.endWeek,
        milestone: phase.isMilestone,
        colorClass: timeline.hasResourceData ? cls : 'sin-datos',
        tooltip: `${phase.name}: S${phase.startWeek}–S${phase.endWeek} (${phase.durationWeeks} sem)`,
      },
    ],
  }));

  const warningBanner = timeline.hasResourceData
    ? ''
    : `<div class="error-banner" style="color:var(--warn);border-color:var(--warn);background:color-mix(in srgb, var(--warn) 15%, transparent)">
         Clúster ${site.cluster} no tiene datos de asignación de recursos en el Excel fuente — este sitio se
         excluye del cálculo de choques de recursos y de costo de nómina hasta que se agreguen esas filas.
       </div>`;

  return `
    <div class="panel">
      <label for="site-select"><strong>Sitio:</strong></label>
      <select id="site-select" style="margin-left:8px; padding:4px 8px;">${siteOptions(model, brewery)}</select>
    </div>
    ${warningBanner}
    ${renderProfileCard(site)}
    <h2>Línea de tiempo (madurez ${timeline.maturity}, arranque semana ${timeline.startWeek})</h2>
    <div class="panel">
      ${renderGanttSVG({ rows: ganttRows, totalWeeks: Math.max(timeline.finishWeek, 1), title: `Gantt ${brewery}` })}
    </div>
    <h2>Detalle de fases y recursos</h2>
    <div class="panel">
      ${renderPhaseDetailTable(model, timeline)}
      <p class="subtitle" style="margin-top:10px;">Fin estimado: semana ${timeline.finishWeek} (≈${(timeline.finishWeek / CONFIG.WEEKS_PER_MONTH).toFixed(1)} meses desde el arranque del sitio).</p>
    </div>
  `;
}

async function main() {
  try {
    const workbook = await loadWorkbook();
    const model = await buildDomainModel(workbook);

    const params = new URLSearchParams(window.location.search);
    const initialBrewery = params.get('site') && model.sites.some((s) => s.brewery === params.get('site'))
      ? params.get('site')
      : model.sites[0].brewery;

    function draw(brewery) {
      content.innerHTML = renderSite(model, brewery);
      document.getElementById('site-select').addEventListener('change', (e) => {
        const url = new URL(window.location.href);
        url.searchParams.set('site', e.target.value);
        window.history.replaceState({}, '', url);
        draw(e.target.value);
      });
    }

    draw(initialBrewery);
    window.__wmsModel = model;
  } catch (err) {
    content.innerHTML = `<div class="error-banner">${err.message}</div>`;
    console.error(err);
  }
}

main();
