import { renderNav } from '../ui/nav.js';
import { loadWorkbook } from '../data/xlsx-loader.js';
import { buildDomainModel } from '../data/schema.js';
import { evaluateScenario } from '../state/store.js';
import { getAllScenarios } from '../domain/scenario-presets.js';
import { CONFIG } from '../config.js';

renderNav('informe.html');
const content = document.getElementById('content');

function money(mxn) {
  return `$${Math.round(mxn).toLocaleString('es-MX')} MXN`;
}

function meses(v) {
  return `${v.toFixed(1)} meses`;
}

function findByName(evals, name) {
  return evals.find((e) => e.scenario.name === name);
}

async function main() {
  try {
    const workbook = await loadWorkbook();
    const model = await buildDomainModel(workbook);
    const scenarios = getAllScenarios(model);
    const evals = scenarios.map((scenario) => ({ scenario, result: evaluateScenario(model, scenario) }));

    const actual = findByName(evals, 'Actual');
    const atraso40 = findByName(evals, '+40% de atraso');
    const optimo = findByName(evals, 'Óptimo');

    const clustersSinDatos = model.clustersWithoutResourceData;
    const sitiosSinDatos = model.sites.filter((s) => clustersSinDatos.includes(s.cluster)).map((s) => s.brewery);

    content.innerHTML = `
      <h2>Resumen en una línea</h2>
      <p class="destacado">
        Con la gente que hay hoy ("Actual"), el programa no cabe en 8 meses — se estira a
        ${actual.result.criticalPath.programFinishWeek} semanas (${meses(actual.result.cost.programDurationMonths)}).
        ${optimo.result.withinHorizon
          ? `El escenario "Óptimo" que encontramos sí cabe en ${optimo.result.criticalPath.programFinishWeek} semanas
             (${meses(optimo.result.cost.programDurationMonths)}) por ${money(optimo.result.cost.totalCostMXN)}.`
          : `Búsqueda honesta, resultado incómodo: ni agregando gente logramos meter el programa en 8 meses. Lo más
             rápido que encontramos son ${optimo.result.criticalPath.programFinishWeek} semanas
             (${meses(optimo.result.cost.programDurationMonths)}) por ${money(optimo.result.cost.totalCostMXN)}.`}
      </p>

      <h2>¿Cuál es el problema, en español sencillo?</h2>
      <p>
        Vamos a instalar un sistema que organiza los almacenes (WMS) en 15 bodegas — 7 en México, 8 en Colombia.
        Cada bodega pasa por 8 pasos (desde preparar el sitio hasta el acompañamiento post-arranque), y cada paso
        necesita gente específica: un arquitecto, un líder de infraestructura, capacitadores, etc. El problema es
        que esa gente es limitada — hoy, para casi todos los puestos, solo hay 1 persona en toda la empresa. Si dos
        bodegas necesitan al mismo especialista en la misma semana, una de las dos tiene que esperar.
      </p>

      <h2>Lo que encontramos con la gente de hoy ("Actual")</h2>
      <p>
        Ni siquiera hace falta que dos bodegas compitan entre sí para tener un problema: <strong>una sola bodega,
        sola, sin ninguna otra corriendo al mismo tiempo, ya se queda sin suficiente gente</strong> durante su etapa
        final de acompañamiento (Hipercuidado) — ese paso necesita 3 capacitadores trabajando a la vez, y la empresa
        solo tiene 1. Eso pasa ${actual.result.structural.length} veces a lo largo del programa (contando todas las
        bodegas y semanas). Encima de eso, cuando varias bodegas sí compiten por la misma gente en la misma semana,
        aparecen ${actual.result.cross.length} choques más. En conjunto, la única forma de evitar que las bodegas se
        estorben entre sí estira el programa a ${actual.result.criticalPath.programFinishWeek} semanas —
        ${(actual.result.criticalPath.programFinishWeek / CONFIG.PROGRAM_HORIZON_WEEKS).toFixed(1)} veces la meta de 8 meses.
      </p>

      <h2>¿Qué pasa si todo se atrasa 40%?</h2>
      <p>
        Este escenario no agrega gente ni quita: solo simula que cada una de las 8 fases, en las 15 bodegas, tarda
        40% más de lo planeado (imprevistos, retrabajos, lo normal en un programa real). Con el headcount de hoy,
        eso estira el programa a ${atraso40.result.criticalPath.programFinishWeek} semanas
        (${meses(atraso40.result.cost.programDurationMonths)}) y el costo sube a ${money(atraso40.result.cost.totalCostMXN)}
        — más nómina, porque la gente sigue contratada más tiempo. Es la prueba de que "Actual" no tiene ningún
        colchón: cualquier atraso real empeora un plan que ya de por sí no cumplía la meta.
      </p>

      <h2>La recomendación: escenario "Óptimo"</h2>
      <p>
        Buscamos el punto medio: la menor cantidad de gente que logra que el programa completo (las 15 bodegas)
        termine en 8 meses sin ningún choque. ${optimo.scenario.description}
        ${optimo.result.withinHorizon
          ? `Esto cuesta ${money(optimo.result.cost.totalCostMXN)} y termina en
             ${meses(optimo.result.cost.programDurationMonths)} — cumple la meta de tiempo con el menor gasto que
             encontramos que la cumple.`
          : `No encontramos ninguna combinación que cumpliera la meta de 8 meses. La recomendación honesta con estos
             datos es: o se negocia con Dirección un plazo mayor a 8 meses, o se reduce cuántos sitios corren en
             simultáneo (por ejemplo, dividir el programa en dos oleadas) — ambas rutas se pueden probar
             directamente en la pestaña Recursos.`}
      </p>

      <h2>Cómo leer el resto de la herramienta</h2>
      <ul>
        <li><strong>Costos</strong> (portada): cuánto cuesta cada bodega (desglosado tal como lo pide el brief:
          dispositivos, montacargas, señalización, etiquetas, y las 3 opciones de WiFi) y cada puesto (nómina), en
          pesos o dólares, más el retorno de inversión.</li>
        <li><strong>Programa</strong>: el calendario completo de las 15 bodegas, agrupadas por país. Da clic en
          cualquier bodega para desplegar sus 8 fases y ver qué gente consume cada una — la bodega en rojo es la
          que más tarda, y por eso es la que define cuándo termina todo el programa.</li>
        <li><strong>Recursos</strong>: aquí se puede subir o bajar cuánta gente hay por puesto, y ver al instante
          cómo cambian los choques, la duración y el costo.</li>
        <li><strong>Escenarios</strong>: compara Actual, +40% de atraso, y Óptimo lado a lado, y permite
          guardar/exportar escenarios propios.</li>
        <li><strong>Datos</strong>: las 6 pestañas del Excel original, tal como se leyeron, con cualquier hueco de
          información marcado con claridad.</li>
      </ul>

      <h2>Limitaciones que hay que conocer</h2>
      <ul>
        <li>${sitiosSinDatos.join(', ') || 'Ningún sitio'} (clúster ${clustersSinDatos.join(', ')}) no tiene datos de
          qué gente consume en el Excel original — se excluye del cálculo de choques/costo de nómina en vez de
          inventar un número.</li>
        <li>El escenario "Óptimo" viene de una búsqueda greedy en 2 fases (agregar gente al rol más problemático,
          luego podar el exceso), no de un optimizador matemático exacto — es un muy buen punto de partida, no la
          certeza absoluta de que no existe nada mejor.</li>
        <li>El calendario de cada escenario lo propone una heurística automática (empezar por la bodega más pesada
          en consumo de recursos) — es ajustable a mano en la pestaña Recursos, no es la única forma de acomodar
          las 15 bodegas.</li>
        <li>El brief original pedía 8 escenarios distintos; por decisión de Laisa esta versión se quedó con 3
          (Actual, +40% de atraso, Óptimo) para no saturar la comparación.</li>
      </ul>
    `;
  } catch (err) {
    content.innerHTML = `<div class="error-banner">${err.message}</div>`;
    console.error(err);
  }
}

main();
