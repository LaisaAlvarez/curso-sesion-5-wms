// Regla de negocio confirmada: Mexico y Colombia nunca se intercalan, pero
// SIEMPRE se muestran juntos (uno junto al otro), nunca uno sustituyendo al
// otro. Un solo helper compartido para que ninguna vista nueva la rompa.

const COUNTRY_ORDER = ['Mexico', 'México', 'Colombia'];
const COUNTRY_CLASS = { Mexico: 'mexico', México: 'mexico', Colombia: 'colombia' };

export function groupByCountry(rows, countryField = 'country') {
  const groups = new Map();
  for (const row of rows) {
    const country = row[countryField] ?? 'Sin país';
    if (!groups.has(country)) groups.set(country, []);
    groups.get(country).push(row);
  }
  const ordered = [...COUNTRY_ORDER.filter((c) => groups.has(c)), ...[...groups.keys()].filter((c) => !COUNTRY_ORDER.includes(c))];
  return ordered.map((country) => ({ country, rows: groups.get(country) }));
}

function escapeHtml(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderCountryGroupedTable(rows, columns, countryField = 'country') {
  const groups = groupByCountry(rows, countryField);
  return groups
    .map(({ country, rows: countryRows }) => {
      const cls = COUNTRY_CLASS[country] ?? '';
      const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
      const body = countryRows
        .map(
          (row) =>
            `<tr>${columns
              .map((c) => `<td>${escapeHtml(c.format ? c.format(row[c.key], row) : row[c.key])}</td>`)
              .join('')}</tr>`
        )
        .join('');
      return `
        <div class="country-block ${cls}">
          <span class="country-label">${escapeHtml(country)} (${countryRows.length})</span>
          <div class="table-scroll">
            <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
          </div>
        </div>
      `;
    })
    .join('');
}
