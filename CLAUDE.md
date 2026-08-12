# Sesión-5

## Lograr la implementación de un sistema WMS en 8 meses. 

1. La persona que lleve esto al menor costo, en menor tiempo, gana. 
2. Dirección pide el programa completo en 8 meses. Hoy los recursos son fijos: hay una persona por rol, y cada fase de cada sitio consume una parte de la capacidad de esos roles. Si dos sitios avanzan al mismo tiempo, se pelean a la misma gente.

## Métricas. 
1. Tablero donde se vea el plan de trabajo general inicio - fin del programa	
2. Tablero donde se vea el plan de trabajo por site	
3. Tabla de uso de recursos por sitio y general para el programa. Quiero poder modificar esa tabla 	
4. Poder guardar el escenario	
5. Que me de un resumen de costos para el programa (por escenario), costo por site, por tipo de recurso	

## Rúbrica. 

* 8 meses + menor costo: 50%
* Dashboard principal: Entregables 1, 2 y 5 visibles y funcionando. 10%
* Guardar y comparar escenarios: Entregables 3 y 4. 10%
* Explicacion y entendimiento de cada pestaña del Excel: 10%
* Calidad de la información. Correcta, bien etiquetada, sin basura ni errores: 10%
* Visual / UI. Limpio, con jerarquía y legible: 10%

## Reglas de exceles. 
1. Todo tiene que ser manejado en pesos mexicanos. Sin embargo tendremos que tener un convertidor de a dólares con una tasa de $18.00. 
2. La tabla está en inglés. Tendrás que traducirla.
3. Tenemos que crear escenarios: 
   * 5% de atraso. 
   * 10% de atraso. 
   * Haremos una tabla de FTE (full time employee), sin embargo haremos escenarios agregando más empleados, nunca menos, todos los puestos son necesarios en este proyecto. 
   * Escenario con menor ahorro, pero menor tiempo. 
   * Escenario con mayor ahorro, pero mayor tiempo.
   * Escenario óptimo: gana la persona que tenga los mejores ahorros. Por lo tanto tendremos que encontrar la estrategia donde sean =<8 meses con la menor cantidad de dinero. 
4. Muéstrame un diagrama de Gantt con cada actividad. El diagrama de Gantt lo quiero tipo Microsoft Project, incluye su ruta crítica, incluye quiénes son las personas que harán dicha actividad o áreas. El caso, necesito que se vea visual, no lleno de información. Podemos evaluar las opciones. 
5. Muéstrame un informe ejecutivo explicando cada gráfica, el Gantt, cada hallazgo. 
6. Lo vamos a subir a GitHub. 
7. Tiene que tener un idioma para CEO, para sin complicaciones, sin inglés, necesito que todo el idioma o lenguaje que uses lo pueden entender CEO's y personas no CEO's. Ok? 
8. En cada tabla representativa y gráfica vas a dividirlo por México y Colombia. A qué me refiero: en cada gráfica habrá reagrupaciones de México y Colombia, pero siempre tendrán que estar juntas. Ejemplo: 

País    Almacén
México     1
México     2
México     3
México     4
Colombia   1
Colombia   2

* Nunca los mezcles entre uno y otro, tienen que permanecer juntos, más no revueltos. 

## Reglas de la tarea: 
* El objetivo, los 5 entregables y la rúbrica con la que se te califica. Es la misma que ves aquí abajo.
Sites Master
* 15 sitios (7 en México, 8 en Colombia), cada uno con su cluster (1 a 4), capacidad y producción, volumen de distribución, número y área de almacenes, ocupación, y su condición de arranque: identificación de pasillos y cajas, control tower, montacargas, estado del WiFi, tablets y equipos de conteo.
Financials (USD)
* Por sitio: beneficio mensual que deja el WMS una vez vivo, y los costos de implementación — dispositivos, estructura de montacargas, señalización, etiquetas e impresoras, etiquetado manual, y tres opciones de WiFi (full, optimizado, priorizado).
Resource Master
* 18 roles (arquitecto de solución, líderes funcional / infraestructura / SAP / Azure, entrenadores, soporte…). De cada uno: si es interno o externo, si su costo es fijo o flexible, si puede multitarea, su costo mensual en MXN, y cuántas personas hay hoy (Actual) contra las que propone el Escenario 1.
Implementation Phases
* Las 8 fases por las que pasa cada sitio, en orden: Site Readiness → Design Adaptation → Functional Review → UAT → Training → DIALT → Go Live → Hypercare. La duración en semanas cambia según el cluster y el nivel de madurez (A o B): entre 10 y 19 semanas por sitio.
Phase-Resource Allocation
* La llave de todo el problema: qué roles consume cada fase de cada cluster y en qué proporción (Capacity Consumption). Aquí es donde se ve por qué dos sitios en paralelo se estorban.
* No modifiques la data del archivo. Los números son los que son; tu simulador se alimenta de ellos tal cual.
* Los escenarios del archivo deben correr en tu simulador. Tanto Actual como Escenario 1 tienen que poder cargarse y calcularse.
* Debes de limpiar el Excel, no puede haber inconsistencias. 
* Tampoco inventes datos. 


 

