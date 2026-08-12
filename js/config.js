// Constantes visibles del ejercicio. Todo lo que sea un supuesto vive aqui,
// nunca escondido dentro de una formula.

export const CONFIG = {
  FX_RATE_MXN_PER_USD: 18.0, // fijo, definido por el brief del curso
  PROGRAM_START_DATE: '2026-08-12', // fecha de arranque asumida del programa completo
  PROGRAM_HORIZON_WEEKS: 35, // ~8 meses
  WEEKS_PER_MONTH: 4.345, // 52/12, para convertir semanas <-> meses de nomina
  DATA_FILE_PATH: 'docs/wms-scenarios-s5 (traducido).xlsx',

  // Politica de datos confirmada con la usuaria: si un cluster no tiene NINGUNA
  // fila en "Asignacion de Recursos por Fase" (hoy es el caso de Cluster 4 /
  // Site 12), nunca se inventan filas. js/data/schema.js detecta esto
  // dinamicamente (no esta hardcodeado aqui) y lo expone en dataWarnings[]; el
  // motor de choques/costo de recursos excluye esos clusters del calculo.

  DEFAULT_MATURITY_BY_CLUSTER: { 1: 'A', 2: 'A', 3: 'A', 4: 'A' },

  // "WiFi Completo" / "WiFi Completo Optimizado" / "WiFi Priorizado" y
  // "Impresoras de Etiquetas / Etiquetadoras" / "Etiquetado Manual" son
  // alternativas (no se suman). Default confirmado: la mas barata por sitio.
  WIFI_DEFAULT_STRATEGY: 'cheapest',
  LABELING_DEFAULT_STRATEGY: 'cheapest',
  WIFI_COLUMNS: ['WiFi Completo', 'WiFi Completo Optimizado', 'WiFi Priorizado'],
  LABELING_COLUMNS: ['Impresoras de Etiquetas / Etiquetadoras', 'Etiquetado Manual'],

  // Modelo de costo de recursos confirmado: nomina fija por headcount contratado
  // (no medido por fraccion de uso). Ver js/domain/cost.js.
  RESOURCE_COST_MODEL: 'nomina-fija-por-headcount',

  PHASE_SEQUENCE: [
    'Preparación del Sitio',
    'Adaptación de Diseño',
    'Revisión Funcional',
    'UAT',
    'Capacitación',
    'DIALT',
    'Arranque',
    'Hipercuidado',
  ],
};
