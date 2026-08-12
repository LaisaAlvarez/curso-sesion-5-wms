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
    const escenario1 = findByName(evals, 'Escenario 1');
    const fteMinimo = findByName(evals, 'FTE mínimo viable');
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
          : `Búsqueda honesta, resultado incómodo: ni agregando gente hasta el máximo que probamos (5 personas por
             puesto) logramos meter el programa en 8 meses. Lo más rápido que encontramos son
             ${optimo.result.criticalPath.programFinishWeek} semanas (${meses(optimo.result.cost.programDurationMonths)})
             por ${money(optimo.result.cost.totalCostMXN)} — 8 meses puede no ser alcanzable con este alcance de 15
             sitios en simultáneo, sin importar cuánta gente se contrate dentro de lo que probamos.`}
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

      <h2>¿Qué pasa si contratamos más gente?</h2>
      <p>
        El archivo original ya trae una alternativa ("Escenario 1": 5 personas por puesto en vez de 1). Con eso, el
        programa sí termina en ${escenario1.result.criticalPath.programFinishWeek} semanas
        (${meses(escenario1.result.cost.programDurationMonths)}) y sin ningún choque — pero cuesta
        ${money(escenario1.result.cost.totalCostMXN)}, más que con la gente de hoy, porque estás pagando nómina de
        mucha más gente.
      </p>
      <p>
        Probamos algo más específico: agregar SOLO lo mínimo necesario para que ninguna bodega, sola, se quede sin
        gente en su paso más exigente (en la práctica, subir capacitadores de 1 a 3). Eso arregla por completo el
        problema "una bodega no puede ni sola" (${fteMinimo.result.structural.length} choques estructurales), pero
        todavía deja ${fteMinimo.result.cross.length} choques por competencia entre bodegas — o sea, no alcanza para
        que las 15 bodegas avancen en paralelo, solo para que cada una individualmente sea viable.
      </p>

      <h2>La recomendación: escenario "Óptimo"</h2>
      <p>
        Buscamos el punto medio: la menor cantidad de gente que logra que el programa completo (las 15 bodegas)
        termine en 8 meses sin ningún choque. ${optimo.scenario.description}
        ${optimo.result.withinHorizon
          ? `Esto cuesta ${money(optimo.result.cost.totalCostMXN)} y termina en
             ${meses(optimo.result.cost.programDurationMonths)} — cumple la meta de tiempo con el menor gasto que
             encontramos que la cumple.`
          : `No encontramos, dentro de lo que probamos (hasta 5 personas por puesto), ninguna combinación que
             cumpliera la meta de 8 meses. La recomendación honesta con estos datos es: o se negocia con Dirección
             un plazo mayor a 8 meses, o se reduce cuántos sitios corren en simultáneo (por ejemplo, dividir el
             programa en dos oleadas), o se busca contratar bastante más allá de 5 personas por puesto — cada una de
             esas tres rutas se puede probar directamente en la pestaña Recursos.`}
      </p>

      <h2>Cómo leer el resto de la herramienta</h2>
      <ul>
        <li><strong>Programa</strong>: el calendario completo de las 15 bodegas, agrupadas por país, con la bodega
          que más tarda resaltada (esa es la que define cuándo termina todo el programa).</li>
        <li><strong>Por Sitio</strong>: el detalle de una sola bodega — sus 8 pasos, cuánto dura cada uno, y qué
          gente necesita.</li>
        <li><strong>Recursos</strong>: aquí se puede subir o bajar cuánta gente hay por puesto, y ver al instante
          cómo cambian los choques, la duración y el costo.</li>
        <li><strong>Escenarios</strong>: compara los 8 escenarios pedidos lado a lado, y permite guardar/exportar
          los tuyos.</li>
        <li><strong>Costos</strong>: cuánto cuesta cada bodega (implementación) y cada puesto (nómina), en pesos o
          dólares.</li>
        <li><strong>Datos</strong>: las 6 pestañas del Excel original, tal como se leyeron, con cualquier hueco de
          información marcado con claridad.</li>
      </ul>

      <h2>Limitaciones que hay que conocer</h2>
      <ul>
        <li>${sitiosSinDatos.join(', ') || 'Ningún sitio'} (clúster ${clustersSinDatos.join(', ')}) no tiene datos de
          qué gente consume en el Excel original — se excluye del cálculo de choques/costo de nómina en vez de
          inventar un número.</li>
        <li>El escenario "Óptimo" viene de una búsqueda simple (probar más gente poco a poco hasta que alcance),
          no de un optimizador matemático — es un muy buen punto de partida, no la certeza absoluta de que no existe
          nada mejor.</li>
        <li>El calendario de cada escenario lo propone una heurística automática (empezar por la bodega más pesada
          en consumo de recursos) — es ajustable a mano en la pestaña Recursos, no es la única forma de acomodar
          las 15 bodegas.</li>
      </ul>
    `;
  } catch (err) {
    content.innerHTML = `<div class="error-banner">${err.message}</div>`;
    console.error(err);
  }
}

main();
