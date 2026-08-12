import { renderNav } from '../ui/nav.js';
import { renderCountryGroupedTable } from '../ui/country-groups.js';
import { loadWorkbook } from '../data/xlsx-loader.js';
import { buildDomainModel } from '../data/schema.js';

renderNav('datos.html');

const content = document.getElementById('content');

function fmtNum(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v !== 'number') return v;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function renderWarnings(warnings) {
  if (warnings.length === 0) {
    return `<p class="subtitle">Sin advertencias de calidad de datos.</p>`;
  }
  const items = warnings
    .map(
      (w) => `
        <li class="warning-item ${w.severity}">
          <span class="code">${w.code} · severidad: ${w.severity}</span>
          ${w.message}
          ${w.items ? `<ul>${w.items.map((i) => `<li>${i}</li>`).join('')}</ul>` : ''}
        </li>`
    )
    .join('');
  return `<ul class="warning-list">${items}</ul>`;
}

function renderKpis(model) {
  return `
    <div class="kpi-row">
      <div class="kpi"><div class="label">Sitios</div><div class="value">${model.sites.length}</div></div>
      <div class="kpi"><div class="label">Roles (agrupados)</div><div class="value">${model.resourcePools.length}</div></div>
      <div class="kpi"><div class="label">Filas de fase</div><div class="value">${model.phases.length}</div></div>
      <div class="kpi"><div class="label">Filas de asignación (sumadas)</div><div class="value">${model.allocations.length}</div></div>
      <div class="kpi"><div class="label">Advertencias</div><div class="value">${model.dataWarnings.length}</div></div>
    </div>
  `;
}

const TABS = [
  { key: 'sitios', label: 'Maestro de Sitios' },
  { key: 'financieros', label: 'Financieros (USD)' },
  { key: 'recursos', label: 'Maestro de Recursos' },
  { key: 'fases', label: 'Fases de Implementación' },
  { key: 'asignacion', label: 'Asignación de Recursos por Fase' },
];

function renderTabsPanel(model) {
  const panels = {
    sitios: renderCountryGroupedTable(
      model.sites,
      [
        { key: 'brewery', label: 'Sitio' },
        { key: 'cluster', label: 'Clúster' },
        { key: 'capacityMioHL', label: 'Capacidad (Mio HL)', format: fmtNum },
        { key: 'productionMioHL', label: 'Producción (Mio HL)', format: fmtNum },
        { key: 'warehouseCount', label: '# Almacenes' },
        { key: 'warehouseArea', label: 'Área Almacén', format: fmtNum },
        { key: 'controlTower', label: 'Torre de Control' },
        { key: 'wifiState', label: 'Estado WiFi', format: fmtNum },
      ],
      'country'
    ),
    financieros: renderCountryGroupedTable(
      model.financials,
      [
        { key: 'brewery', label: 'Sitio' },
        { key: 'monthlyBenefit', label: 'Beneficio Mensual', format: fmtNum },
        { key: 'implementationCosts', label: 'Costos Implementación', format: fmtNum },
        { key: 'costsWithoutLabelersWifi', label: 'Costos sin Etiq./WiFi', format: fmtNum },
        { key: 'wifiFull', label: 'WiFi Completo', format: fmtNum },
        { key: 'wifiFullOptimized', label: 'WiFi Optimizado', format: fmtNum },
        { key: 'wifiPrioritized', label: 'WiFi Priorizado', format: fmtNum },
        { key: 'labelPrintersLabelers', label: 'Etiquetadoras', format: fmtNum },
        { key: 'manualLabeling', label: 'Etiquetado Manual', format: fmtNum },
      ],
      'country'
    ),
    recursos: `
      <div class="table-scroll">
        <table>
          <thead><tr>
            <th>Rol</th><th>Variantes</th><th>Actual (total)</th><th>Escenario 1 (total)</th>
            <th>Costo mensual promedio (MXN)</th>
          </tr></thead>
          <tbody>
            ${model.resourcePools
              .map(
                (p) => `
              <tr>
                <td>${p.role}</td>
                <td>${p.isCombinedPool ? p.variants.map((v) => v.internalOrExternal).join(' + ') : p.variants[0].internalOrExternal}</td>
                <td>${p.actualTotal}</td>
                <td>${p.escenario1Total}</td>
                <td>${fmtNum(p.blendedMonthlyCostMXN)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `,
    fases: `
      <div class="table-scroll">
        <table>
          <thead><tr><th>Clúster</th><th>Fase</th><th>Secuencia</th><th>Madurez</th><th>Duración (semanas)</th></tr></thead>
          <tbody>
            ${model.phases
              .map((p) => `<tr><td>${p.cluster}</td><td>${p.phase}</td><td>${p.sequence}</td><td>${p.maturity}</td><td>${p.durationWeeks}</td></tr>`)
              .join('')}
          </tbody>
        </table>
      </div>
    `,
    asignacion: `
      <div class="table-scroll">
        <table>
          <thead><tr><th>Clúster</th><th>Fase</th><th>Rol</th><th>Consumo de capacidad (sumado)</th><th># filas sumadas</th></tr></thead>
          <tbody>
            ${model.allocations
              .map(
                (a) =>
                  `<tr><td>${a.cluster}</td><td>${a.phase}</td><td>${a.role}</td><td>${fmtNum(a.capacityConsumption)}</td><td>${a.rowCount}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `,
  };

  const buttons = TABS.map((t, i) => `<button data-tab="${t.key}" class="${i === 0 ? 'active' : ''}">${t.label}</button>`).join('');
  const panelsHtml = TABS.map((t, i) => `<div class="tab-panel" data-tab="${t.key}" style="${i === 0 ? '' : 'display:none'}">${panels[t.key]}</div>`).join('');

  return `<div class="tabs">${buttons}</div>${panelsHtml}`;
}

function wireTabs() {
  content.querySelectorAll('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      content.querySelectorAll('.tab-panel').forEach((p) => {
        p.style.display = p.dataset.tab === btn.dataset.tab ? '' : 'none';
      });
    });
  });
}

async function main() {
  try {
    const workbook = await loadWorkbook();
    const model = await buildDomainModel(workbook);

    content.innerHTML = `
      ${renderKpis(model)}
      <h2>Advertencias de calidad de datos</h2>
      <div class="panel">${renderWarnings(model.dataWarnings)}</div>
      <h2>Pestañas</h2>
      ${renderTabsPanel(model)}
    `;
    wireTabs();

    window.__wmsModel = model; // ayuda para inspeccionar desde la consola mientras se construye
  } catch (err) {
    content.innerHTML = `<div class="error-banner">${err.message}</div>`;
    console.error(err);
  }
}

main();
