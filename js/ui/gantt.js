// Gantt en SVG estilo "outline" (grupo colapsable + tareas hijas
// conectadas), como Microsoft Project - sin libreria externa. Cada sitio es
// un grupo con una barra resumen tipo corchete; al expandirlo aparecen sus
// 8 fases como filas hijas conectadas con una linea (las fases de un mismo
// sitio son secuenciales sin huecos, asi que el conector siempre es una
// linea vertical: donde termina la fase N empieza la N+1, misma semana).

const ROW_HEIGHT = 26;
const BAR_HEIGHT = 15;
const GROUP_BAR_HEIGHT = 7;
const WEEK_WIDTH = 14;
const LABEL_WIDTH = 230;
const TOP_PADDING = 30;
const LEFT_PADDING = 12;
const CHILD_INDENT = 20;
const BAR_GAP = 2;

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function flattenRows(groups) {
  const rows = [];
  for (const g of groups) {
    rows.push({ kind: 'group', ...g });
    if (g.expanded && g.children) {
      g.children.forEach((c, i) => rows.push({ kind: 'child', ...c, isLastInGroup: i === g.children.length - 1 }));
    }
  }
  return rows;
}

// groups: [{ id, label, startWeek, endWeek, colorClass, tooltip, expanded,
//            children: [{ label, startWeek, endWeek, colorClass, tooltip, milestone }] }]
export function renderProjectGantt({ groups, totalWeeks, weekWidth = WEEK_WIDTH, weeksPerMonth, title }) {
  const rows = flattenRows(groups);
  const chartWidth = LABEL_WIDTH + totalWeeks * weekWidth + LEFT_PADDING * 2;
  const chartHeight = TOP_PADDING + rows.length * ROW_HEIGHT + 10;

  const weekStep = Math.max(1, Math.round(totalWeeks / 20));
  const gridlines = [];
  for (let w = 0; w <= totalWeeks; w += weekStep) {
    const x = LABEL_WIDTH + w * weekWidth;
    gridlines.push(
      `<line x1="${x}" y1="${TOP_PADDING - 6}" x2="${x}" y2="${chartHeight - 6}" class="gantt-gridline" />` +
        `<text x="${x}" y="${TOP_PADDING - 12}" class="gantt-weeklabel" text-anchor="middle">S${w}</text>`
    );
  }
  if (weeksPerMonth) {
    for (let m = 1; m * weeksPerMonth <= totalWeeks; m++) {
      const x = LABEL_WIDTH + m * weeksPerMonth * weekWidth;
      gridlines.push(`<line x1="${x}" y1="${TOP_PADDING - 6}" x2="${x}" y2="${chartHeight - 6}" class="gantt-gridline month" />`);
    }
  }

  const rowsHtml = rows
    .map((row, i) => {
      const y = TOP_PADDING + i * ROW_HEIGHT;
      const midY = y + ROW_HEIGHT / 2;

      if (row.kind === 'group') {
        const toggleGlyph = row.expanded ? '▾' : '▸';
        const x0 = LABEL_WIDTH + row.startWeek * weekWidth;
        const x1 = LABEL_WIDTH + row.endWeek * weekWidth;
        const barCls = `gantt-bar ${row.colorClass ?? ''}`;
        const bracket = `
          <line x1="${x0}" y1="${midY}" x2="${x1}" y2="${midY}" class="${barCls} gantt-bracket-line" />
          <line x1="${x0}" y1="${midY}" x2="${x0}" y2="${midY + 6}" class="${barCls} gantt-bracket-line" />
          <line x1="${x1}" y1="${midY}" x2="${x1}" y2="${midY + 6}" class="${barCls} gantt-bracket-line" />
          ${row.tooltip ? `<title>${escapeHtml(row.tooltip)}</title>` : ''}
        `;
        return `
          <g class="gantt-group-row" data-group-id="${escapeHtml(row.id)}">
            <rect x="0" y="${y}" width="${chartWidth}" height="${ROW_HEIGHT}" class="gantt-hit-area" />
            <text x="${LEFT_PADDING}" y="${midY + 4}" class="gantt-toggle">${toggleGlyph}</text>
            <text x="${LEFT_PADDING + 16}" y="${midY + 4}" class="gantt-rowlabel emphasis">${escapeHtml(row.label)}</text>
            ${bracket}
          </g>
        `;
      }

      // fila hija (fase)
      const labelX = LEFT_PADDING + CHILD_INDENT;
      const label = `<text x="${labelX}" y="${midY + 4}" class="gantt-rowlabel">${escapeHtml(row.label)}</text>`;
      const x = LABEL_WIDTH + row.startWeek * weekWidth;
      const cls = `gantt-bar ${row.colorClass ?? ''}`;
      const titleTag = row.tooltip ? `<title>${escapeHtml(row.tooltip)}</title>` : '';
      let bar;
      if (row.milestone) {
        const size = 6;
        bar = `<polygon points="${x},${midY - size} ${x + size},${midY} ${x},${midY + size} ${x - size},${midY}" class="${cls} gantt-milestone">${titleTag}</polygon>`;
      } else {
        const w = Math.max(3, (row.endWeek - row.startWeek) * weekWidth - BAR_GAP);
        const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
        const r = Math.min(4, w / 2, BAR_HEIGHT / 2);
        bar = `<rect x="${x}" y="${barY}" width="${w}" height="${BAR_HEIGHT}" rx="${r}" class="${cls}">${titleTag}</rect>`;
      }

      // conector: como las fases de un sitio son secuenciales sin huecos,
      // el final de esta fase (misma semana) es donde arranca la siguiente -
      // una linea vertical de la fila N a la fila N+1, con punta de flecha.
      let connector = '';
      if (!row.isLastInGroup) {
        const connX = LABEL_WIDTH + row.endWeek * weekWidth;
        const yBottom = y + ROW_HEIGHT;
        const yTop = y + ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
        connector = `
          <line x1="${connX}" y1="${midY}" x2="${connX}" y2="${yTop}" class="gantt-connector" />
          <polygon points="${connX - 3},${yTop - 5} ${connX + 3},${yTop - 5} ${connX},${yTop}" class="gantt-connector-arrow" />
        `;
      }

      return `<g>${label}${bar}${connector}</g>`;
    })
    .join('');

  return `
    <div class="gantt-scroll">
      <svg viewBox="0 0 ${chartWidth} ${chartHeight}" width="${chartWidth}" height="${chartHeight}" class="gantt-svg" role="img" aria-label="${escapeHtml(title ?? 'Gantt')}">
        ${gridlines.join('')}
        ${rowsHtml}
      </svg>
    </div>
  `;
}

export function renderGanttLegend(legendItems) {
  const items = legendItems
    .map(
      (item) =>
        `<span class="legend-item"><span class="swatch gantt-bar ${item.colorClass ?? ''} ${item.milestone ? 'milestone' : ''}"></span>${escapeHtml(item.label)}</span>`
    )
    .join('');
  return `<div class="chart-legend">${items}</div>`;
}
