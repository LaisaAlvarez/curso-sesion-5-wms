// Banner compartido del "escenario ganador" (Costos y Programa lo usan
// identico) - evita que cada pagina calcule/muestre esto de forma distinta.
export function renderWinnerBanner(winner, currentScenarioId, formatMoney) {
  if (!winner) {
    return `<div class="warning-item alto" style="margin-bottom:18px;">Ningún escenario logra caber en 8 meses sin choques — no hay "ganador" todavía con lo que se ha probado.</div>`;
  }
  const isViewingWinner = winner.scenario.id === currentScenarioId;
  return `
    <div class="panel" style="border-left:4px solid var(--status-good); display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
      <div style="font-size:22px;">🏆</div>
      <div style="flex:1; min-width:220px;">
        <div style="font-weight:650;">Escenario ganador: ${winner.scenario.name}</div>
        <div class="text-secondary" style="font-size:13px;">
          El de menor costo entre los que sí caben en 8 meses sin choques: ${winner.result.criticalPath.programFinishWeek} sem,
          ${formatMoney(winner.result.cost.totalCostMXN)}.
        </div>
      </div>
      ${isViewingWinner
        ? `<span class="badge-good">viendo el ganador</span>`
        : `<button id="jump-to-winner-btn">Ver este escenario</button>`}
    </div>
  `;
}
