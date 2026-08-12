import { renderNav } from '../ui/nav.js';
import { loadWorkbook } from '../data/xlsx-loader.js';
import { buildDomainModel } from '../data/schema.js';
import { evaluateScenario } from '../state/store.js';
import { getAllScenarios } from '../domain/scenario-presets.js';
import { loadCustomScenarios, exportScenarioToFile, importScenarioFromFile, saveCustomScenario } from '../state/persistence.js';
import { CONFIG } from '../config.js';

renderNav('escenarios.html');
const content = document.getElementById('content');

function fmtMoney(v) {
  return '$' + Math.round(v).toLocaleString('es-MX');
}

function renderComparisonTable(evaluations) {
  const rows = evaluations
    .map(({ scenario, result }) => {
      const feasibleLabel = result.feasible ? 'Sí' : `No (${result.structural.length} choque(s) estructurales)`;
      const withinLabel = result.withinHorizon ? 'Sí' : 'No';
      return `
        <tr>
          <td><strong>${scenario.name}</strong><br/><span class="subtitle" style="font-size:11.5px;">${scenario.description}</span></td>
          <td>${result.criticalPath.programFinishWeek} sem<br/>(${result.cost.programDurationMonths.toFixed(1)} meses)</td>
          <td style="color:${result.withinHorizon ? 'var(--ok)' : 'var(--danger)'}">${withinLabel}</td>
          <td style="color:${result.feasible ? 'var(--ok)' : 'var(--danger)'}">${feasibleLabel}</td>
          <td>${result.cross.length}</td>
          <td>${fmtMoney(result.cost.totalCostMXN)} MXN</td>
          <td>${fmtMoney(result.cost.totalCostMXN / CONFIG.FX_RATE_MXN_PER_USD)} USD</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="table-scroll">
      <table>
        <thead><tr>
          <th>Escenario</th><th>Duración</th><th>≤8 meses</th><th>Sin choques estructurales</th>
          <th>Choques por traslape</th><th>Costo total (MXN)</th><th>Costo total (USD)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderCustomScenarios(customScenarios) {
  if (customScenarios.length === 0) return '<p class="subtitle">No has guardado ningún escenario propio todavía.</p>';
  return `<ul class="warning-list">${customScenarios
    .map((s) => `<li class="warning-item">${s.name || s.id} · guardado ${new Date(s.createdAt).toLocaleString('es-MX')}</li>`)
    .join('')}</ul>`;
}

async function main() {
  try {
    const workbook = await loadWorkbook();
    const model = await buildDomainModel(workbook);

    const scenarios = getAllScenarios(model);
    const evaluations = scenarios.map((scenario) => ({ scenario, result: evaluateScenario(model, scenario) }));
    const customScenarios = loadCustomScenarios();

    content.innerHTML = `
      <h2>Comparación</h2>
      <div class="panel">${renderComparisonTable(evaluations)}</div>

      <h2>Escenarios propios (guardados en este navegador)</h2>
      <div class="panel">
        ${renderCustomScenarios(customScenarios)}
        <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
          <input type="file" id="import-file" accept=".json" style="display:none;" />
          <button id="import-btn">Importar escenario (.json)</button>
        </div>
      </div>

      <h2>Exportar un escenario del comparativo</h2>
      <div class="panel">
        <select id="export-select">
          ${scenarios.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
        <button id="export-btn" style="margin-left:8px;">Descargar como .json</button>
      </div>
    `;

    document.getElementById('export-btn').addEventListener('click', () => {
      const id = document.getElementById('export-select').value;
      const scenario = scenarios.find((s) => s.id === id);
      exportScenarioToFile(scenario);
    });

    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const scenario = await importScenarioFromFile(file);
        saveCustomScenario(scenario);
        main();
      } catch (err) {
        alert(err.message);
      }
    });

    window.__wmsModel = model;
    window.__wmsEvaluations = evaluations;
  } catch (err) {
    content.innerHTML = `<div class="error-banner">${err.message}</div>`;
    console.error(err);
  }
}

main();
