import { renderNav } from '../ui/nav.js';
import { loadWorkbook } from '../data/xlsx-loader.js';
import { buildDomainModel } from '../data/schema.js';
import { evaluateScenario } from '../state/store.js';
import { getAllScenarios } from '../domain/scenario-presets.js';
import { buildWeeklyDemandTable } from '../domain/conflicts.js';
import { saveCustomScenario } from '../state/persistence.js';
import { CONFIG } from '../config.js';

renderNav('recursos.html');
const content = document.getElementById('content');

function fmtMoney(v) {
  return '$' + Math.round(v).toLocaleString('es-MX');
}

let state = null; // { model, scenarios, currentScenario, overrides }

function baseHeadcount(model, scenario) {
  const map = {};
  for (const pool of model.resourcePools) {
    map[pool.role] = scenario.fteBase === 'Escenario 1' ? pool.escenario1Total : pool.actualTotal;
  }
  return map;
}

function renderFteTable(model, scenario, overrides) {
  const base = baseHeadcount(model, scenario);
  const rows = model.resourcePools
    .map((pool) => {
      const baseVal = base[pool.role];
      const overrideVal = overrides[pool.role] ?? baseVal;
      return `
        <tr>
          <td>${pool.role}</td>
          <td>${baseVal}</td>
          <td>
            <input type="number" min="${baseVal}" step="1" value="${overrideVal}" data-role="${pool.role}"
                   class="fte-input" style="width:70px; padding:3px 6px;" />
          </td>
          <td>${fmtMoney(pool.blendedMonthlyCostMXN)}/mes</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="table-scroll">
      <table>
        <thead><tr><th>Rol</th><th>Base (${scenario.fteBase})</th><th>Headcount a usar</th><th>Costo mensual (MXN)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="subtitle" style="margin-top:8px;">Nunca puedes bajar del headcount base — todos los roles son necesarios (regla del brief). Sube el número para agregar gente.</p>
  `;
}

function renderResultSummary(result) {
  return `
    <div class="kpi-row">
      <div class="kpi"><div class="label">Duración</div><div class="value">${result.criticalPath.programFinishWeek} sem</div></div>
      <div class="kpi"><div class="label">Cabe en 8 meses</div><div class="value ${result.withinHorizon ? 'status-good' : 'status-critical'}">${result.withinHorizon ? 'Sí' : 'No'}</div></div>
      <div class="kpi"><div class="label">Choques estructurales</div><div class="value ${result.structural.length ? 'status-warning' : 'status-good'}">${result.structural.length}</div></div>
      <div class="kpi"><div class="label">Choques por traslape</div><div class="value ${result.cross.length ? 'status-critical' : 'status-good'}">${result.cross.length}</div></div>
      <div class="kpi"><div class="label">Costo total</div><div class="value">${fmtMoney(result.cost.totalCostMXN)}<span class="sub"> MXN</span></div></div>
    </div>
  `;
}

function renderDemandTable(model, result) {
  const table = buildWeeklyDemandTable(model, result.timelines, result.headcountByRole);
  const maxWeeks = Math.min(result.criticalPath.programFinishWeek, 60);
  const head = `<th>Rol</th>` + Array.from({ length: maxWeeks }, (_, w) => `<th>S${w}</th>`).join('');
  const rows = table
    .map((r) => {
      const cells = r.weeks
        .slice(0, maxWeeks)
        .map((w) => `<td class="${w.overloaded ? 'demand-cell-overloaded' : ''}">${w.demand ? w.demand.toFixed(1) : ''}</td>`)
        .join('');
      return `<tr><td>${r.role}</td>${cells}</tr>`;
    })
    .join('');
  const truncatedNote = result.criticalPath.programFinishWeek > maxWeeks
    ? `<p class="subtitle">Mostrando las primeras ${maxWeeks} semanas de ${result.criticalPath.programFinishWeek} (la tabla completa es muy ancha para mostrar de golpe).</p>`
    : '';
  return `
    ${renderLegendInline()}
    <div class="table-scroll">${truncatedNote}<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
  `;
}

function renderLegendInline() {
  return `<div class="chart-legend"><span class="legend-item"><span class="swatch status-critical"></span>Semana con choque (se necesita más gente de la que hay)</span></div>`;
}

function renderDemandExplainer() {
  return `
    <div class="warning-item info" style="margin-bottom:14px;">
      <span class="code">Cómo leer esta tabla</span>
      Cada <strong>fila</strong> es un rol (ej. "Líder de Azure"). Cada <strong>columna</strong> es una semana del
      programa. El número dentro de cada celda es cuánta gente de ESE rol se necesita en ESA semana, sumando
      <strong>todos los sitios</strong> que en ese momento estén corriendo una fase que use a ese rol — no es la
      gente que hay, es la gente que se está pidiendo. Compáralo contra el "Headcount a usar" de la tabla de arriba:
      si el número pedido es mayor a la gente contratada, la celda se pinta de rojo — significa que esa semana, ese
      rol, no alcanza para atender a todos los sitios que lo necesitan al mismo tiempo.
    </div>
  `;
}

function attachHandlers() {
  document.getElementById('scenario-select').addEventListener('change', (e) => {
    state.currentScenario = state.scenarios.find((s) => s.id === e.target.value);
    state.overrides = { ...state.currentScenario.fteOverrides };
    render();
  });

  document.querySelectorAll('.fte-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const role = e.target.dataset.role;
      const base = baseHeadcount(state.model, state.currentScenario)[role];
      const val = Math.max(base, Number(e.target.value) || base);
      state.overrides[role] = val;
      render();
    });
  });

  document.getElementById('save-scenario-btn').addEventListener('click', () => {
    const name = prompt('¿Cómo quieres nombrar este escenario?', `${state.currentScenario.name} (editado)`);
    if (!name) return;
    const toSave = {
      ...state.currentScenario,
      id: `custom-${Date.now()}`,
      name,
      fteOverrides: state.overrides,
    };
    saveCustomScenario(toSave);
    alert('Escenario guardado en este navegador. Puedes exportarlo a archivo desde la pestaña Escenarios.');
  });
}

function render() {
  const { model, currentScenario, overrides } = state;
  const scenarioForEval = { ...currentScenario, fteOverrides: overrides };
  const result = evaluateScenario(model, scenarioForEval);

  content.innerHTML = `
    <div class="panel">
      <label><strong>Escenario base:</strong></label>
      <select id="scenario-select" style="margin-left:8px; padding:4px 8px;">
        ${state.scenarios.map((s) => `<option value="${s.id}" ${s.id === currentScenario.id ? 'selected' : ''}>${s.name}</option>`).join('')}
      </select>
      <button id="save-scenario-btn" style="margin-left:12px;">Guardar como nuevo escenario</button>
    </div>

    <h2>Resultado con este headcount</h2>
    <div class="panel">${renderResultSummary(result)}</div>

    <h2>Headcount por rol</h2>
    <div class="panel">${renderFteTable(model, currentScenario, overrides)}</div>

    <h2>¿Qué rol se queda corto, y en qué semana?</h2>
    <div class="panel">
      ${renderDemandExplainer()}
      ${renderDemandTable(model, result)}
    </div>
  `;

  attachHandlers();
  window.__wmsResult = result;
}

async function main() {
  try {
    const workbook = await loadWorkbook();
    const model = await buildDomainModel(workbook);
    const scenarios = getAllScenarios(model);

    state = { model, scenarios, currentScenario: scenarios[0], overrides: { ...scenarios[0].fteOverrides } };
    render();
    window.__wmsModel = model;
  } catch (err) {
    content.innerHTML = `<div class="error-banner">${err.message}</div>`;
    console.error(err);
  }
}

main();
