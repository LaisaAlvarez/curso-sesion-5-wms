// Lee el xlsx real en cada carga de pagina (fetch + SheetJS), nunca un JSON
// pre-exportado a mano. Asi, si el archivo fuente cambia, el simulador lo
// refleja solo, sin paso de "resincronizar".
//
// Requiere que la pagina cargue SheetJS como script clasico antes de este
// modulo: <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
// window.XLSX queda disponible como variable global.

import { CONFIG } from '../config.js';

export async function loadWorkbook() {
  const url = encodeURI(CONFIG.DATA_FILE_PATH);
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(
      `No se pudo cargar "${CONFIG.DATA_FILE_PATH}". Si abriste este HTML con doble-clic ` +
        `(file://), el navegador bloquea esta lectura por CORS. Usa tools/serve.ps1 y abre ` +
        `http://localhost:8080 en vez de abrir el archivo directo. Detalle: ${err.message}`
    );
  }
  if (!response.ok) {
    throw new Error(`No se encontro "${CONFIG.DATA_FILE_PATH}" (HTTP ${response.status}).`);
  }
  const buffer = await response.arrayBuffer();
  if (typeof window.XLSX === 'undefined') {
    throw new Error('SheetJS (window.XLSX) no esta cargado. Revisa el <script> de xlsx.full.min.js en el HTML.');
  }
  const workbook = window.XLSX.read(new Uint8Array(buffer), { type: 'array' });
  return workbook;
}

// Nombres reales de las pestanias en el archivo (SIN acento, tal como quedaron
// escritas en el archivo real - no son los nombres "bonitos" usados en prosa).
export const SHEET_NAMES = {
  ENTREGABLES: 'ENTREGABLES',
  SITIOS: 'Maestro de Sitios',
  FINANCIEROS: 'Financieros (USD)',
  RECURSOS: 'Maestro de Recursos',
  FASES: 'Fases de Implementacion',
  ASIGNACION: 'Asignacion de Recursos por Fase',
};

export function sheetToRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;
  return window.XLSX.utils.sheet_to_json(sheet, { defval: null });
}
