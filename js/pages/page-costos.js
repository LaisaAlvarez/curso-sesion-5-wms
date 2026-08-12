import { renderNav } from '../ui/nav.js';
import { renderCountryGroupedTable } from '../ui/country-groups.js';
import { loadWorkbook } from '../data/xlsx-loader.js';
import { buildDomainModel } from '../data/schema.js';
import { evaluateScenario } from '../state/store.js';
import { getAllScenarios } from '../domain/scenario-presets.js';
import { CONFIG } from '../config.js';

renderNav('costos.html');
const content = document.getElementById('content');

let state = { currency: 'MXN' };

function money(valueMXN) {
  const value = state.currency === 'MXN' ? valueMXN : valueMXN / CONFIG.FX_RATE_MXN_PER_USD;
  return `${state.currency === 'MXN' ? '$' : 'US$'}${Math.round(value).toLocaleString('es-MX')}`;
}

function renderKpis(result) {
  return `
    <div class="kpi-row">
      <div class="kpi"><div class="label">Costo total del programa</div><div class="value">${money(result.cost.totalCostMXN)}</div></div>
      <div class="kpi"><div class="label">Implementación (única vez)</div><div class="value">${money(result.cost.totalImplementationMXN)}</div></div>
      <div class="kpi"><div class="label">Nómina (${result.cost.programDurationMonths.toFixed(1)} meses)</div><div class="value">${money(result.cost.totalPayrollMXN)}</div></div>
      <div class="kpi"><div class="label">Beneficio mensual (referencia ROI)</div><div class="value">${money(result.cost.totalMonthlyBenefitMXN)}</div></div>
    </div>
  `;
}

function renderPerSiteTable(model, result) {
  const rows = model.sites.map((site) => ({
    country: site.country,
    brewery: site.brewery,
    cluster: site.cluster,
    implementationMXN: (result.cost.perSiteImplementationUSD[site.brewery] ?? 0) * CONFIG.FX_RATE_MXN_PER_USD,
  }));
  return renderCountryGroupedTable(
    rows,
    [
      { key: 'brewery', label: 'Sitio' },
      { key: 'cluster', label: 'Clúster' },
      { key: 'implementationMXN', label: `Costo de implementación (${state.currency})`, format: (v) => money(v) },
    ],
    'country'
  );
}

function renderPerRoleTable(model, result) {
  const rows = model.resourcePools
    .map((pool) => ({
      role: pool.role,
      headcount: result.headcountByRole[pool.role] ?? 0,
      monthlyCostMXN: pool.blendedMonthlyCostMXN,
      totalMXN: result.cost.payrollByRole[pool.role] ?? 0,
    }))
    .sort((a, b) => b.totalMXN - a.totalMXN);

  const rowsHtml = rows
    .map((r) => `<tr><td>${r.role}</td><td>${r.headcount}</td><td>${money(r.monthlyCostMXN)}/mes</td><td>${money(r.totalMXN)}</td></tr>`)
    .join('');

  return `
    <div class="table-scroll">
      <table>
        <thead><tr><th>Rol</th><th>Headcount</th><th>Costo mensual</th><th>Costo total del programa</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

function render(model, scenarios) {
  const scenario = scenarios.find((s) => s.id === state.scenarioId) ?? scenarios[0];
  const result = evaluateScenario(model, scenario);

  content.innerHTML = `
    <div class="panel">
      <label><strong>Escenario:</strong></label>
      <select id="scenario-select" style="margin-left:8px; padding:4px 8px;">
        ${scenarios.map((s) => `<option value="${s.id}" ${s.id === scenario.id ? 'selected' : ''}>${s.name}</option>`).join('')}
      </select>
      <span style="margin-left:20px;"><strong>Moneda:</strong></span>
      <button id="mxn-btn" class="${state.currency === 'MXN' ? 'active' : ''}" style="margin-left:6px; padding:4px 10px; border-radius:6px; border:1px solid var(--border); background:${state.currency === 'MXN' ? 'var(--accent)' : 'var(--bg-panel-2)'}; color:${state.currency === 'MXN' ? 'white' : 'var(--text)'}; cursor:pointer;">MXN</button>
      <button id="usd-btn" style="margin-left:4px; padding:4px 10px; border-radius:6px; border:1px solid var(--border); background:${state.currency === 'USD' ? 'var(--accent)' : 'var(--bg-panel-2)'}; color:${state.currency === 'USD' ? 'white' : 'var(--text)'}; cursor:pointer;">USD</button>
    </div>

    <h2>Resumen — ${scenario.name}</h2>
    <div class="panel">
      ${renderKpis(result)}
      <p class="subtitle">
        El beneficio mensual es una referencia de retorno (ROI), NO se resta del costo — mezclar ambos cambiaría
        artificialmente quién "gana" el reto de menor costo.
      </p>
    </div>

    <h2>Costo de implementación por sitio</h2>
    <div class="panel">${renderPerSiteTable(model, result)}</div>

    <h2>Costo de nómina por rol</h2>
    <div class="panel">
      ${renderPerRoleTable(model, result)}
      <p class="subtitle" style="margin-top:10px;">
        La nómina es un fondo compartido de todo el programa (la misma persona trabaja en varios sitios) — no se
        divide artificialmente por sitio, solo se muestra por rol.
      </p>
    </div>
  `;

  document.getElementById('scenario-select').addEventListener('change', (e) => {
    state.scenarioId = e.target.value;
    render(model, scenarios);
  });
  document.getElementById('mxn-btn').addEventListener('click', () => {
    state.currency = 'MXN';
    render(model, scenarios);
  });
  document.getElementById('usd-btn').addEventListener('click', () => {
    state.currency = 'USD';
    render(model, scenarios);
  });
}

async function main() {
  try {
    const workbook = await loadWorkbook();
    const model = await buildDomainModel(workbook);
    const scenarios = getAllScenarios(model);
    state.scenarioId = scenarios[0].id;
    render(model, scenarios);
    window.__wmsModel = model;
  } catch (err) {
    content.innerHTML = `<div class="error-banner">${err.message}</div>`;
    console.error(err);
  }
}

main();
