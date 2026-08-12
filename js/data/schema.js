// Convierte las filas crudas de las 6 pestanias del xlsx en un modelo de
// dominio tipado, y produce dataWarnings[] para cualquier hueco/rareza real
// encontrada en los datos (nunca los corrige en silencio, nunca inventa).

import { sheetToRows, SHEET_NAMES } from './xlsx-loader.js';

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function yesNo(v) {
  if (v === 'Si' || v === 'Sí') return true;
  if (v === 'No') return false;
  return null;
}

function parseSites(rows) {
  return rows.map((r) => ({
    country: r['Pais'] ?? r['País'],
    brewery: r['Cerveceria'] ?? r['Cervecería'],
    cluster: num(r['Cluster'] ?? r['Clúster']),
    capacityMioHL: num(r['Capacidad (Mio HL)']),
    productionMioHL: num(r['Produccion (Mio HL)'] ?? r['Producción (Mio HL)']),
    distributionVolumeKHL: num(r['Volumen de Distribucion (K HL)'] ?? r['Volumen de Distribución (K HL)']),
    lineCapacity: num(r['Capacidad de Linea'] ?? r['Capacidad de Línea']),
    productionLines: num(r['Lineas de Produccion'] ?? r['Líneas de Producción']),
    warehouseCount: num(r['# Almacenes']),
    warehouseArea: num(r['Area de Almacen'] ?? r['Área de Almacén']),
    occupationLevel: num(r['Nivel de Ocupacion'] ?? r['Nivel de Ocupación']),
    aislesIdentification: num(r['Identificacion de Pasillos'] ?? r['Identificación de Pasillos']),
    boxIdentification: yesNo(r['Identificacion de Cajas'] ?? r['Identificación de Cajas']),
    controlTower: yesNo(r['Torre de Control']),
    t2MkpKa: yesNo(r['T2/MKP/KA']), // sigla de negocio sin confirmar, campo opaco
    forkliftsLogistics: num(r['Montacargas en Logistica'] ?? r['Montacargas en Logística']),
    hcForklifts: num(r['HC Montacargas']),
    wifiState: num(r['Estado de WiFi']),
    tablets: num(r['Tablets']),
    countingDevices: num(r['Dispositivos de Conteo']),
  }));
}

function parseFinancials(rows) {
  return rows.map((r) => ({
    country: r['Pais'] ?? r['País'],
    brewery: r['Cerveceria'] ?? r['Cervecería'],
    monthlyBenefit: num(r['Beneficio Mensual']),
    implementationCosts: num(r['Costos de Implementacion'] ?? r['Costos de Implementación']),
    devices: num(r['Dispositivos']),
    forkliftStructure: num(r['Estructura de Montacargas']),
    warehouseSignage: num(r['Senializacion de Almacen'] ?? r['Señalización de Almacén']),
    labels: num(r['Etiquetas']),
    costsWithoutLabelersWifi: num(r['Costos sin Etiquetadoras y WiFi']),
    labelPrintersLabelers: num(r['Impresoras de Etiquetas / Etiquetadoras']),
    manualLabeling: num(r['Etiquetado Manual']),
    wifiFull: num(r['WiFi Completo']),
    wifiFullOptimized: num(r['WiFi Completo Optimizado']),
    wifiPrioritized: num(r['WiFi Priorizado']),
  }));
}

// Decision confirmada: los roles "Interno" y "Externo" del mismo nombre se
// combinan en una sola bolsa de capacidad (Asignacion de Recursos por Fase no
// distingue cual de las dos variantes consume cada fase). Se suma headcount y
// nomina total; el costo por persona reportado es el promedio ponderado.
function parseAndAggregateResources(rows) {
  const variants = rows
    .filter((r) => r['Rol'])
    .map((r) => ({
      role: r['Rol'],
      workMode: r['Modalidad de Trabajo'],
      canMultitask: r['Puede Multitarea'],
      internalOrExternal: r['Interno o Externo'],
      fixedOrFlexible: r['Costo Fijo o Flexible'],
      monthlyCostMXN: num(r['Costo Mensual Promedio (MXN)']),
      actual: num(r['Actual']),
      escenario1: num(r['Escenario 1']),
    }));

  const byRole = new Map();
  for (const v of variants) {
    if (!byRole.has(v.role)) byRole.set(v.role, []);
    byRole.get(v.role).push(v);
  }

  const pools = [];
  for (const [role, vs] of byRole.entries()) {
    const actualTotal = vs.reduce((s, v) => s + (v.actual ?? 0), 0);
    const escenario1Total = vs.reduce((s, v) => s + (v.escenario1 ?? 0), 0);
    const payrollActualTotal = vs.reduce((s, v) => s + (v.actual ?? 0) * (v.monthlyCostMXN ?? 0), 0);
    const blendedMonthlyCostMXN = actualTotal > 0 ? payrollActualTotal / actualTotal : (vs[0].monthlyCostMXN ?? 0);
    pools.push({
      role,
      variants: vs,
      isCombinedPool: vs.length > 1,
      actualTotal,
      escenario1Total,
      blendedMonthlyCostMXN,
    });
  }
  return pools;
}

function parsePhases(rows) {
  return rows
    .filter((r) => r['Fase'])
    .map((r) => ({
      cluster: num(r['Cluster'] ?? r['Clúster']),
      phase: r['Fase'],
      sequence: num(r['Secuencia']),
      maturity: r['Madurez de Despliegue'],
      durationWeeks: num(r['Duracion en Semanas'] ?? r['Duración en Semanas']),
    }));
}

// Decision confirmada: filas repetidas de (cluster, fase, rol) -en particular
// Hipercuidado, que trae 2-3 filas del mismo rol en cada cluster con datos- se
// SUMAN (representan gente en paralelo), nunca se deduplican.
function parseAndAggregateAllocations(rows) {
  const raw = rows
    .filter((r) => r['Rol'])
    .map((r) => ({
      cluster: num(r['Cluster'] ?? r['Clúster']),
      phase: r['Fase'],
      role: r['Rol'],
      capacityConsumption: num(r['Consumo de Capacidad']),
    }));

  const byKey = new Map();
  for (const r of raw) {
    const key = `${r.cluster}|${r.phase}|${r.role}`;
    if (!byKey.has(key)) {
      byKey.set(key, { cluster: r.cluster, phase: r.phase, role: r.role, capacityConsumption: 0, rowCount: 0 });
    }
    const entry = byKey.get(key);
    entry.capacityConsumption += r.capacityConsumption ?? 0;
    entry.rowCount += 1;
  }
  return Array.from(byKey.values());
}

function detectWarnings({ sites, phases, allocations }) {
  const warnings = [];

  const clustersInPhases = new Set(phases.map((p) => p.cluster));
  const clustersInAllocations = new Set(allocations.map((a) => a.cluster));
  const clustersWithoutResourceData = [...clustersInPhases].filter((c) => !clustersInAllocations.has(c)).sort();

  if (clustersWithoutResourceData.length > 0) {
    const affectedSites = sites.filter((s) => clustersWithoutResourceData.includes(s.cluster)).map((s) => s.brewery);
    warnings.push({
      severity: 'alto',
      code: 'CLUSTER_SIN_ASIGNACION_RECURSOS',
      message:
        `Clúster(es) ${clustersWithoutResourceData.join(', ')} no tienen NINGUNA fila en ` +
        `"Asignación de Recursos por Fase". Sitios afectados: ${affectedSites.join(', ') || 'ninguno'}. ` +
        `Decisión: se excluyen del cálculo de choques de recursos y de costo de nómina — ` +
        `no se inventan filas. Sus fases sí se muestran en el Gantt.`,
      clusters: clustersWithoutResourceData,
    });
  }

  const dupHipercuidado = allocations.filter((a) => a.rowCount > 1);
  if (dupHipercuidado.length > 0) {
    warnings.push({
      severity: 'info',
      code: 'FILAS_REPETIDAS_SUMADAS',
      message:
        `${dupHipercuidado.length} combinaciones (clúster, fase, rol) tenían más de una fila en el ` +
        `Excel original (ej. Hipercuidado con "Capacitadores" x3) — se sumaron sus fracciones de ` +
        `consumo de capacidad, se trataron como gente en paralelo, no como duplicado de captura.`,
      items: dupHipercuidado.map((a) => `${a.role} (clúster ${a.cluster}, ${a.phase}): x${a.rowCount}`),
    });
  }

  const zeroDurationPhases = phases.filter((p) => p.durationWeeks === 0);
  if (zeroDurationPhases.length > 0) {
    warnings.push({
      severity: 'info',
      code: 'FASE_DURACION_CERO',
      message:
        `${zeroDurationPhases.length} fase(s) tienen 0 semanas de duración (se renderizan como hito, ` +
        `no como barra) — ej. clúster ${zeroDurationPhases[0].cluster}, "${zeroDurationPhases[0].phase}".`,
      items: zeroDurationPhases.map((p) => `Clúster ${p.cluster} / Madurez ${p.maturity} / ${p.phase}`),
    });
  }

  return { warnings, clustersWithoutResourceData };
}

export async function buildDomainModel(workbook) {
  const sitesRows = sheetToRows(workbook, SHEET_NAMES.SITIOS) ?? [];
  const financialsRows = sheetToRows(workbook, SHEET_NAMES.FINANCIEROS) ?? [];
  const resourcesRows = sheetToRows(workbook, SHEET_NAMES.RECURSOS) ?? [];
  const phasesRows = sheetToRows(workbook, SHEET_NAMES.FASES) ?? [];
  const allocationsRows = sheetToRows(workbook, SHEET_NAMES.ASIGNACION) ?? [];

  const sites = parseSites(sitesRows);
  const financials = parseFinancials(financialsRows);
  const resourcePools = parseAndAggregateResources(resourcesRows);
  const phases = parsePhases(phasesRows);
  const allocations = parseAndAggregateAllocations(allocationsRows);

  const { warnings, clustersWithoutResourceData } = detectWarnings({ sites, phases, allocations });

  return {
    sites,
    financials,
    resourcePools,
    phases,
    allocations,
    dataWarnings: warnings,
    clustersWithoutResourceData,
    raw: { sitesRows, financialsRows, resourcesRows, phasesRows, allocationsRows },
  };
}
