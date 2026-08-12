import { CONFIG } from '../config.js';

const LINKS = [
  { href: 'index.html', label: 'Costos' },
  { href: 'programa.html', label: 'Programa' },
  { href: 'recursos.html', label: 'Recursos' },
  { href: 'escenarios.html', label: 'Escenarios' },
  { href: 'informe.html', label: 'Informe Ejecutivo' },
  { href: 'datos.html', label: 'Datos' },
];

export function renderNav(activeHref) {
  const mount = document.getElementById('app-nav');
  if (!mount) return;

  const links = LINKS.map(
    (l) => `<a href="${l.href}" class="${l.href === activeHref ? 'active' : ''}">${l.label}</a>`
  ).join('');

  mount.innerHTML = `
    <header class="app-nav">
      <span class="brand">Simulador WMS</span>
      <nav>${links}</nav>
      <span class="spacer"></span>
      <span class="fx-banner">Tipo de cambio: ${CONFIG.FX_RATE_MXN_PER_USD.toFixed(2)} MXN/USD (fijo, para este ejercicio)</span>
    </header>
  `;
}
