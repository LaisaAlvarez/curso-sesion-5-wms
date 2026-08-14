import { renderNav } from '../ui/nav.js';
import { renderCountryGroupedTable } from '../ui/country-groups.js';
import { loadWorkbook } from '../data/xlsx-loader.js';
import { buildDomainModel } from '../data/schema.js';
import { evaluateScenario } from '../state/store.js';
import { getAllScenarios } from '../domain/scenario-presets.js';
import { findWinningScenario } from '../domain/winner.js';
import { renderWinnerBanner } from '../ui/winner-banner.js';
import { CONFIG } from '../config.js';

renderNav('index.html');
const content = document.getElementById('content');

let state = { currency: 'MXN' };

function money(valueMXN) {
  const value = state.currency === 'MXN' ? valueMXN : valueMXN / CONFIG.FX_RATE_MXN_PER_USD;
  return `${state.currency === 'MXN' ? '$' : 'US$'}${Math.round(value).toLocaleString('es-MX')}`;
}

function renderKpis(result) {
  const totalFte = Object.values(result.headcountByRole).reduce((a, b) => a + b, 0);
  const paybackMonths = result.cost.totalMonthlyBenefitMXN > 0 ? result.cost.totalCostMXN / result.cost.totalMonthlyBenefitMXN : null;
  return `
    <div class="kpi-row">
      <div class="kpi kpi-hero"><div class="label">Costo total del programa</div><div class="value">${money(result.cost.totalCostMXN)}</div></div>
      <div class="kpi"><div class="label">Implementación (única vez)</div><div class="value">${money(result.cost.totalImplementationMXN)}</div></div>
      <div class="kpi"><div class="label">Nómina (${result.cost.programDurationMonths.toFixed(1)} meses)</div><div class="value">${money(result.cost.totalPayrollMXN)}</div></div>
      <div class="kpi"><div class="label">Gente total (FTE)</div><div class="value">${totalFte}</div></div>
      <div class="kpi">
        <div class="label">Retorno de inversión</div>
        <div class="value">${paybackMonths ? paybackMonths.toFixed(1) : '—'}<span class="sub"> meses</span></div>
        <div class="sub">con ${money(result.cost.totalMonthlyBenefitMXN)}/mes de beneficio</div>
      </div>
    </div>
  `;
}

// Desglose literal, tal como lo describe el brief (CLAUDE.md): "Por sitio:
// beneficio mensual... y los costos de implementacion - dispositivos,
// estructura de montacargas, senializacion, etiquetas e impresoras,
// etiquetado manual, y tres opciones de WiFi (full, optimizado,
// priorizado)". Se muestran los componentes crudos, no un numero ya
// colapsado a "la opcion mas barata" - esa eleccion sigue existiendo (se ve
// en el KPI de arriba, que sí necesita elegir una para dar un total), pero
// aqui se ve el detalle completo para que no quede escondido.
function renderLiteralBreakdown(model) {
  return renderCountryGroupedTable(
    model.financials,
    [
      { key: 'brewery', label: 'Sitio' },
      { key: 'monthlyBenefit', label: 'Beneficio mensual', format: money },
      { key: 'implementationCosts', label: 'Costos de implementación', format: money },
      { key: 'devices', label: 'Dispositivos', format: money },
      { key: 'forkliftStructure', label: 'Estructura de montacargas', format: money },
      { key: 'warehouseSignage', label: 'Señalización', format: money },
      { key: 'labels', label: 'Etiquetas', format: money },
      { key: 'labelPrintersLabelers', label: 'Impresoras / Etiquetadoras', format: money },
      { key: 'manualLabeling', label: 'Etiquetado manual', format: money },
      { key: 'wifiFull', label: 'WiFi Full', format: money },
      { key: 'wifiFullOptimized', label: 'WiFi Optimizado', format: money },
      { key: 'wifiPrioritized', label: 'WiFi Priorizado', format: money },
    ],
    'country'
  );
}

function renderPerSiteScenarioTable(model, result) {
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
      { key: 'implementationMXN', label: 'Costo elegido (más barato)', format: (v) => money(v) },
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

function render(model, scenarios, winner) {
  const scenario = scenarios.find((s) => s.id === state.scenarioId) ?? scenarios[0];
  const result = evaluateScenario(model, scenario);

  content.innerHTML = `
    ${renderWinnerBanner(winner, scenario.id, money)}

    <div class="panel" style="display:flex; align-items:center; gap:24px; flex-wrap:wrap;">
      <div>
        <label for="scenario-select"><strong>Escenario:</strong></label>
        <select id="scenario-select" style="margin-left:8px; padding:5px 10px;">
          ${scenarios.map((s) => `<option value="${s.id}" ${s.id === scenario.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="tabs" style="margin:0;">
        <button id="mxn-btn" class="${state.currency === 'MXN' ? 'active' : ''}">MXN</button>
        <button id="usd-btn" class="${state.currency === 'USD' ? 'active' : ''}">USD</button>
      </div>
    </div>

    <h2>Resumen — ${scenario.name}</h2>
    <div class="panel">
      ${renderKpis(result)}
      <p class="subtitle">
        El beneficio mensual es una referencia de retorno (ROI), NO se resta del costo — mezclar ambos cambiaría
        artificialmente quién "gana" el reto de menor costo.
      </p>
    </div>

    <h2>Desglose de costos por sitio (como lo pide el brief)</h2>
    <div class="panel">
      ${renderLiteralBreakdown(model)}
      <p class="subtitle" style="margin-top:10px;">
        "WiFi Full", "Optimizado" y "Priorizado" son 3 alternativas — no se suman entre sí, cada sitio elige una
        (igual con etiquetado manual vs. impresoras). El escenario actual usa la opción más barata de cada sitio;
        aquí se ven las 3 completas, tal como vienen en el Excel fuente.
      </p>
    </div>

    <h2>Costo elegido por sitio (según el escenario)</h2>
    <div class="panel">${renderPerSiteScenarioTable(model, result)}</div>

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
    render(model, scenarios, winner);
  });
  document.getElementById('mxn-btn').addEventListener('click', () => {
    state.currency = 'MXN';
    render(model, scenarios, winner);
  });
  document.getElementById('usd-btn').addEventListener('click', () => {
    state.currency = 'USD';
    render(model, scenarios, winner);
  });
  const jumpBtn = document.getElementById('jump-to-winner-btn');
  if (jumpBtn && winner) {
    jumpBtn.addEventListener('click', () => {
      state.scenarioId = winner.scenario.id;
      render(model, scenarios, winner);
    });
  }
}

async function main() {
  try {
    const workbook = await loadWorkbook();
    const model = await buildDomainModel(workbook);
    const scenarios = getAllScenarios(model);
    const evaluations = scenarios.map((scenario) => ({ scenario, result: evaluateScenario(model, scenario) }));
    const winner = findWinningScenario(evaluations);
    state.scenarioId = (winner?.scenario ?? scenarios[0]).id;
    render(model, scenarios, winner);
    window.__wmsModel = model;
  } catch (err) {
    content.innerHTML = `<div class="error-banner">${err.message}</div>`;
    console.error(err);
  }
}

main();
