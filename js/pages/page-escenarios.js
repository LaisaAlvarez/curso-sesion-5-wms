import { renderNav } from '../ui/nav.js';
import { loadWorkbook } from '../data/xlsx-loader.js';
import { buildDomainModel } from '../data/schema.js';
import { evaluateScenario } from '../state/store.js';
import { getAllScenarios } from '../domain/scenario-presets.js';
import { findWinningScenario } from '../domain/winner.js';
import { loadCustomScenarios, exportScenarioToFile, importScenarioFromFile, saveCustomScenario } from '../state/persistence.js';
import { CONFIG } from '../config.js';

renderNav('escenarios.html');
const content = document.getElementById('content');

function fmtMoney(v) {
  return '$' + Math.round(v).toLocaleString('es-MX');
}

function renderComparisonTable(evaluations) {
  const winner = findWinningScenario(evaluations);

  const rows = evaluations
    .map(({ scenario, result }) => {
      const isWinner = winner && scenario.id === winner.scenario.id;
      const feasibleLabel = result.feasible ? 'Sí' : `No (${result.structural.length})`;
      const withinLabel = result.withinHorizon ? 'Sí' : 'No';
      return `
        <tr class="${isWinner ? 'row-recommended' : ''}">
          <td class="wrap-cell"><strong>${scenario.name}</strong>${isWinner ? ' <span class="badge-good">recomendado</span>' : ''}<br/><span class="text-secondary" style="font-size:11.5px;">${scenario.description}</span></td>
          <td>${result.criticalPath.programFinishWeek} sem<br/><span class="text-muted">(${result.cost.programDurationMonths.toFixed(1)} meses)</span></td>
          <td class="${result.withinHorizon ? 'status-good-text' : 'status-critical-text'}">${withinLabel}</td>
          <td class="${result.feasible ? 'status-good-text' : 'status-warning-text'}">${feasibleLabel}</td>
          <td class="${result.cross.length ? 'status-critical-text' : 'status-good-text'}">${result.cross.length}</td>
          <td>${fmtMoney(result.cost.totalCostMXN)}</td>
          <td>${fmtMoney(result.cost.totalCostMXN / CONFIG.FX_RATE_MXN_PER_USD)}</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="table-scroll">
      <table>
        <thead><tr>
          <th>Escenario</th><th>Duración</th><th>≤8 meses</th><th>Sin choques estruct.</th>
          <th>Choques traslape</th><th>Costo (MXN)</th><th>Costo (USD)</th>
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
