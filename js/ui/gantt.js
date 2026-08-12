// Renderizador de Gantt en SVG, a mano (sin libreria). Especificaciones de
// marca (dataviz skill, marks-and-anatomy.md): barras con extremo
// redondeado de 4px, gap de 2px entre barras, hitos como diamante con
// anillo de superficie, leyenda siempre presente cuando hay 2+ series o
// estados en juego.

const ROW_HEIGHT = 28;
const BAR_HEIGHT = 18; // <= 24px, deja aire arriba/abajo
const WEEK_WIDTH = 16;
const LABEL_WIDTH = 190;
const TOP_PADDING = 30;
const LEFT_PADDING = 12;
const BAR_GAP = 2; // separador de superficie entre barras adyacentes

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// rows: [{ label, emphasis?, segments: [{startWeek, endWeek, colorClass, tooltip, milestone}] }]
export function renderGanttSVG({ rows, totalWeeks, weekWidth = WEEK_WIDTH, title, weeksPerMonth }) {
  const chartWidth = LABEL_WIDTH + totalWeeks * weekWidth + LEFT_PADDING * 2;
  const chartHeight = TOP_PADDING + rows.length * ROW_HEIGHT + 10;

  const weekStep = Math.max(1, Math.round(totalWeeks / 20));
  const weekTicks = [];
  for (let w = 0; w <= totalWeeks; w += weekStep) {
    const x = LABEL_WIDTH + w * weekWidth;
    weekTicks.push(
      `<line x1="${x}" y1="${TOP_PADDING - 6}" x2="${x}" y2="${chartHeight - 6}" class="gantt-gridline" />` +
        `<text x="${x}" y="${TOP_PADDING - 12}" class="gantt-weeklabel" text-anchor="middle">S${w}</text>`
    );
  }

  // Lineas de mes (mas visibles) ademas de las de semana, si se da el dato
  if (weeksPerMonth) {
    for (let m = 1; m * weeksPerMonth <= totalWeeks; m++) {
      const x = LABEL_WIDTH + m * weeksPerMonth * weekWidth;
      weekTicks.push(`<line x1="${x}" y1="${TOP_PADDING - 6}" x2="${x}" y2="${chartHeight - 6}" class="gantt-gridline month" />`);
    }
  }

  const rowsHtml = rows
    .map((row, i) => {
      const y = TOP_PADDING + i * ROW_HEIGHT;
      const labelCls = row.emphasis ? 'gantt-rowlabel emphasis' : 'gantt-rowlabel';
      const label = `<text x="${LEFT_PADDING}" y="${y + ROW_HEIGHT / 2 + 4}" class="${labelCls}">${escapeHtml(row.label)}</text>`;
      const segs = row.segments
        .map((seg) => {
          const x = LABEL_WIDTH + seg.startWeek * weekWidth;
          const cls = `gantt-bar ${seg.colorClass ?? ''}`;
          const titleTag = seg.tooltip ? `<title>${escapeHtml(seg.tooltip)}</title>` : '';
          if (seg.milestone) {
            const cy = y + ROW_HEIGHT / 2;
            const size = 6;
            return `<polygon points="${x},${cy - size} ${x + size},${cy} ${x},${cy + size} ${x - size},${cy}" class="${cls} gantt-milestone">${titleTag}</polygon>`;
          }
          const w = Math.max(3, (seg.endWeek - seg.startWeek) * weekWidth - BAR_GAP);
          const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
          const r = Math.min(4, w / 2, BAR_HEIGHT / 2);
          return `<rect x="${x}" y="${barY}" width="${w}" height="${BAR_HEIGHT}" rx="${r}" class="${cls}">${titleTag}</rect>`;
        })
        .join('');
      return `<g>${label}${segs}</g>`;
    })
    .join('');

  // Se dibuja a su tamano real (nunca aplastado a 100% de ancho) - un
  // programa de 100+ semanas necesita scroll horizontal, no un grafico
  // ilegible comprimido para caber en la pantalla.
  return `
    <div class="gantt-scroll">
      <svg viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}" class="gantt-svg" role="img" aria-label="${escapeHtml(title ?? 'Gantt')}">
        ${weekTicks.join('')}
        ${rowsHtml}
      </svg>
    </div>
  `;
}

// legendItems: [{ label, colorClass, milestone? }] - lee el color real desde
// las custom properties del CSS (mismo mecanismo que las barras) via una
// clase compartida, para que la leyenda nunca se desincronice de los
// colores reales del grafico.
export function renderGanttLegend(legendItems) {
  const items = legendItems
    .map(
      (item) =>
        `<span class="legend-item"><span class="swatch gantt-bar ${item.colorClass ?? ''} ${item.milestone ? 'milestone' : ''}"></span>${escapeHtml(item.label)}</span>`
    )
    .join('');
  return `<div class="chart-legend">${items}</div>`;
}
