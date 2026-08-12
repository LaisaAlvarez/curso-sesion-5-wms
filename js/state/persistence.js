// Escenarios creados/editados a mano por el usuario en el navegador. Un
// sitio estatico (GitHub Pages) no puede escribir de vuelta a su propio
// repo, asi que esto vive en localStorage + export/import a archivo JSON.

const STORAGE_KEY = 'wms-simulator:scenarios';

export function loadCustomScenarios() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomScenario(scenario) {
  const scenarios = loadCustomScenarios().filter((s) => s.id !== scenario.id);
  scenarios.push({ ...scenario, createdAt: scenario.createdAt ?? new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  return scenarios;
}

export function deleteCustomScenario(id) {
  const scenarios = loadCustomScenarios().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  return scenarios;
}

export function exportScenarioToFile(scenario) {
  const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${scenario.id || 'escenario'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importScenarioFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (err) {
        reject(new Error(`El archivo no es un escenario JSON válido: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsText(file);
  });
}
