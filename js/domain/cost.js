// Algoritmo 3.5 del plan. Modelo de costo confirmado: nomina fija por
// headcount - cada persona contratada cuesta su salario mensual completo
// MIENTRAS CORRE EL PROGRAMA COMPLETO (no solo sus semanas activas). Por eso
// agregar gente sube el costo directo, pero puede acortar el programa - esa
// es la tension real detras de "mayor ahorro pero mayor tiempo".

import { CONFIG } from '../config.js';

function cheapestOf(values) {
  const nums = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  return nums.length ? Math.min(...nums) : 0;
}

export function implementationCostUSD(financialsRow, { wifiChoice, labelingChoice } = {}) {
  const wifiOptions = {
    'WiFi Completo': financialsRow.wifiFull,
    'WiFi Completo Optimizado': financialsRow.wifiFullOptimized,
    'WiFi Priorizado': financialsRow.wifiPrioritized,
  };
  const labelingOptions = {
    'Impresoras de Etiquetas / Etiquetadoras': financialsRow.labelPrintersLabelers,
    'Etiquetado Manual': financialsRow.manualLabeling,
  };

  const wifiCost = wifiChoice ? (wifiOptions[wifiChoice] ?? 0) : cheapestOf(Object.values(wifiOptions));
  const labelingCost = labelingChoice ? (labelingOptions[labelingChoice] ?? 0) : cheapestOf(Object.values(labelingOptions));

  return (financialsRow.costsWithoutLabelersWifi ?? 0) + wifiCost + labelingCost;
}

export function payrollCostMXN(model, headcountByRole, programDurationMonths) {
  let total = 0;
  const byRole = {};
  for (const pool of model.resourcePools) {
    const heads = headcountByRole[pool.role] ?? 0;
    const cost = heads * pool.blendedMonthlyCostMXN * programDurationMonths;
    byRole[pool.role] = cost;
    total += cost;
  }
  return { total, byRole };
}

export function evaluateCost(model, { timelines, headcountByRole, programFinishWeek, scenario }) {
  const programDurationMonths = programFinishWeek / CONFIG.WEEKS_PER_MONTH;

  const perSiteImplementationUSD = {};
  let totalImplementationUSD = 0;
  let totalMonthlyBenefitUSD = 0;

  for (const timeline of timelines) {
    const financialsRow = model.financials.find((f) => f.brewery === timeline.site.brewery);
    if (!financialsRow) continue;
    const wifiChoice = scenario?.wifiChoiceBySite?.[timeline.site.brewery];
    const labelingChoice = scenario?.labelingChoiceBySite?.[timeline.site.brewery];
    const usd = implementationCostUSD(financialsRow, { wifiChoice, labelingChoice });
    perSiteImplementationUSD[timeline.site.brewery] = usd;
    totalImplementationUSD += usd;
    totalMonthlyBenefitUSD += financialsRow.monthlyBenefit ?? 0;
  }

  const totalImplementationMXN = totalImplementationUSD * CONFIG.FX_RATE_MXN_PER_USD;
  const { total: totalPayrollMXN, byRole: payrollByRole } = payrollCostMXN(model, headcountByRole, programDurationMonths);

  return {
    programDurationMonths,
    totalImplementationMXN,
    totalPayrollMXN,
    totalCostMXN: totalImplementationMXN + totalPayrollMXN,
    totalMonthlyBenefitUSD,
    totalMonthlyBenefitMXN: totalMonthlyBenefitUSD * CONFIG.FX_RATE_MXN_PER_USD,
    perSiteImplementationUSD,
    payrollByRole,
  };
}
