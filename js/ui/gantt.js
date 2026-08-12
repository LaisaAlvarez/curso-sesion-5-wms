// Renderizador de Gantt en SVG, a mano (sin libreria) - cada fila es una fase
// o un sitio, cada segmento es una barra [startWeek, endWeek) o un hito
// (diamante) si dura 0 semanas. Reutilizable para el Gantt de un sitio
// (hito b) y el Gantt completo del programa (hito d).

const ROW_HEIGHT = 30;
const WEEK_WIDTH = 16;
const LABEL_WIDTH = 190;
const TOP_PADDING = 30;
const LEFT_PADDING = 12;

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// rows: [{ label, group?, segments: [{startWeek, endWeek, colorClass, tooltip, milestone}] }]
export function renderGanttSVG({ rows, totalWeeks, weekWidth = WEEK_WIDTH, title }) {
  const chartWidth = LABEL_WIDTH + totalWeeks * weekWidth + LEFT_PADDING * 2;
  const chartHeight = TOP_PADDING + rows.length * ROW_HEIGHT + 10;

  const weekTicks = [];
  for (let w = 0; w <= totalWeeks; w += Math.max(1, Math.round(totalWeeks / 20))) {
    const x = LABEL_WIDTH + w * weekWidth;
    weekTicks.push(
      `<line x1="${x}" y1="${TOP_PADDING - 6}" x2="${x}" y2="${chartHeight - 6}" class="gantt-gridline" />` +
        `<text x="${x}" y="${TOP_PADDING - 12}" class="gantt-weeklabel" text-anchor="middle">S${w}</text>`
    );
  }

  const rowsHtml = rows
    .map((row, i) => {
      const y = TOP_PADDING + i * ROW_HEIGHT;
      const label = `<text x="${LEFT_PADDING}" y="${y + ROW_HEIGHT / 2 + 4}" class="gantt-rowlabel">${escapeHtml(row.label)}</text>`;
      const segs = row.segments
        .map((seg) => {
          const x = LABEL_WIDTH + seg.startWeek * weekWidth;
          const cls = `gantt-bar ${seg.colorClass ?? ''}`;
          const titleTag = seg.tooltip ? `<title>${escapeHtml(seg.tooltip)}</title>` : '';
          if (seg.milestone) {
            const cy = y + ROW_HEIGHT / 2;
            const size = 7;
            return `<polygon points="${x},${cy - size} ${x + size},${cy} ${x},${cy + size} ${x - size},${cy}" class="${cls} gantt-milestone">${titleTag}</polygon>`;
          }
          const w = Math.max(2, (seg.endWeek - seg.startWeek) * weekWidth - 2);
          return `<rect x="${x}" y="${y + 4}" width="${w}" height="${ROW_HEIGHT - 10}" rx="3" class="${cls}">${titleTag}</rect>`;
        })
        .join('');
      return `<g>${label}${segs}</g>`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${chartWidth} ${chartHeight}" width="100%" height="${chartHeight}" class="gantt-svg" role="img" aria-label="${escapeHtml(title ?? 'Gantt')}">
      <style>
        .gantt-gridline { stroke: var(--border, #2a2f3a); stroke-width: 1; }
        .gantt-weeklabel { font-size: 10px; fill: var(--text-dim, #9aa2b1); }
        .gantt-rowlabel { font-size: 12px; fill: var(--text, #e7e9ee); }
        .gantt-bar { fill: var(--accent, #4f8dfd); }
        .gantt-bar.mexico { fill: var(--mexico, #3aa3ff); }
        .gantt-bar.colombia { fill: var(--colombia, #ffb020); }
        .gantt-bar.critical { fill: var(--danger, #ff5d5d); }
        .gantt-bar.near-critical { fill: var(--warn, #ffb020); }
        .gantt-bar.sin-datos { fill: var(--text-dim, #9aa2b1); opacity: 0.5; }
        .gantt-milestone { stroke: white; stroke-width: 1; }
      </style>
      ${weekTicks.join('')}
      ${rowsHtml}
    </svg>
  `;
}
