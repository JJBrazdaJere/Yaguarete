# Proyecto: gastos-app

App **web responsive** que recibe un **monto de dinero** y lo **distribuye
porcentualmente** entre categorias de gastos para usar el dinero de forma
eficiente y optimizar en que se gasta.

## Objetivo funcional

1. El usuario escribe un monto (por ejemplo, su ingreso del mes).
2. La app reparte ese monto en categorías con un porcentaje asignado
   (necesidades / deseos / ahorro) **y/o con montos fijos en pesos**.
3. Muestra el resultado claro: grupo, categoría, porcentaje y monto, total,
   **subtotales por grupo**, un **gráfico de torta** (con sector **"Sin
   designar"** si el total no llega al 100% del ingreso) y, en el panel del
   **Consejero**, consejos concretos para acercarte a tu **objetivo** de reparto.
4. Cada categoría puede ser **%** (peso relativo que se estira para usar todo
   el ingreso) o **$** (monto fijo, ej. alquiler) mediante un interruptor en la
   pantalla Ajustar. Los fijos se reservan primero y el resto se reparte entre
   los porcentajes.
5. Permite ajustar, agregar y eliminar categorías, con un **catálogo de
   sugerencias argentinas** (incluye transporte con y sin auto).
6. Los datos se guardan en el dispositivo (localStorage) y se pueden
   **exportar como imagen PNG** (tarjeta con el reparto) o compartir con un
   **enlace** que codifica la configuracion.
7. Los **montos** se escriben con formato argentino **1.000.000,00** (puntos de
   miles y coma decimal), formateados mientras se escribe.
8. En el grupo **Ahorro**, un gasto fijo puede cargarse en **US$**; se convierte
   a pesos con la **cotización del dolar del dia** (dolarapi.com, Bolsa/MEP por
   defecto), con ultimo valor guardado y carga manual si no hay conexion.
9. **Perfiles de reparto** (Gastador 60/30/10, Equilibrado 50/30/20,
   Conservador 45/25/30, Cauto 40/20/40): un toque reparte los porcentajes por
   grupo; las categorias fijas no se tocan. Aplica sobre la **distribucion real
   del ingreso** (incluye fijos), no solo sobre los nominales. La app detecta el
   perfil actual y agrupa la lista de categorias por grupo.
10. **Plan de evolucion**: lleva los porcentajes al ideal 50/30/20 en N meses
    (slider 3-12) con una linea de tiempo y un boton "Aplicar proximo paso".
    La fila **Hoy** muestra la distribucion **real** (incluye montos fijos, por
    eso se ve el azul de Necesidades). Los pasos son **lineales**: con el slider
    en N meses, N toques llegan al ideal. Cada toque muestra el **delta** por
    categoria (`+5 pt` verde / `-3 pt` rojo, y el mismo +/- en el monto) en
    *Resultado* y *Ajustar*; los deltas se limpian al editar a mano. Si un grupo
    tiene fijos por encima del ideal, se avisa que no puede bajar solo con %.
11. **Historial financiero**: panel **siempre visible** a la izquierda, con
    calendario mensual, torta y subtotales por mes, perfil de cada mes y grafico
    de evolucion del ahorro. Se guarda con "Guardar este mes" en el resultado
    (localStorage, no viaja en el enlace). El calendario muestra el monto
    **abreviado** (`1.2M`, `850K`, `1.5K`, `850`) para que no se desborde del
    recuadro; el detalle del mes usa el formato completo.
12. **Panel siempre visible** de **Perfil + Plan + Consejero** a la derecha:
    perfiles de reparto, plan de evolucion y consejos, sin tener que abrir otra
    pantalla.
13. **Consejero**: dado un **objetivo** elegido (perfil Gastador/Equilibrado/
    Conservador/Cauto), compara el % real de cada grupo con el objetivo y sugiere
    en que categoria recortar (por palabras clave del nombre) y cuanto, en $.
    Reemplaza al panel "Para gastar mejor".
14. **Disposicion**: escritorio con 3 zonas (Historial | Reparto | Perfil y plan)
    desde 1200px y 2 zonas entre 900 y 1200px; en el celular una **barra de
    pestanas** abajo (`Reparto · Historial · Perfil y plan`).
15. **Tutorial** (`tutorial.html`): pagina visual e interactiva que ensena todas
    las funcionalidades, paso a paso, con la historia de ejemplo de 12 meses y
    un boton "Probar con el ejemplo". No modifica la app.
16. **Datos de ejemplo** (`datos-ejemplo.js`): `EJEMPLO_PROGRESO` con 12 meses
    (2026) donde el ahorro sube mes a mes y el perfil pasa de Gastador (60/30/10)
    a Equilibrado (50/30/20); `EJEMPLO_CONFIG`, `cargarEjemplo()`,
    `borrarEjemplo()`. Lo usan el tutorial y las pruebas.
17. **Pruebas** (`pruebas.html` + `pruebas.js`): corren **todas las funciones**
    en el navegador (mismo origen, inyectando el script dentro de `index.html`
    en un iframe) y muestran el reporte PASS/FAIL por suite, mas la tabla y el
    JSON de los datos de ejemplo, para que el usuario los chequee. `tests/
    correr-tests.ps1` automatiza lo mismo en Edge headless (codigo de salida 0/1).
18. **Reportar un problema**: boton **flotante** (`🐞 Reportar`) siempre visible
    abajo a la derecha (por encima de la barra de pestanas en el celular). Abre
    WhatsApp (`wa.me/5492920553198`) con el mensaje precargado
    *"Encontre un problema en GastaMejor: "*. Se oculta mientras hay un modal
    abierto (con `:has`).
19. **Tutorial guiado de primera vez** (dentro de la app): al abrir la app **sin
    historial** y sin haberlo visto, arranca un tour estilo juego: oscurece el
    fondo, **resalta** un elemento (spotlight) y muestra un **globo** con el
    "para que sirve / que utilidad le podes dar" y botones **Saltar / Anterior /
    Siguiente** (el ultimo: **Listo**). Recorre **8 pasos** (monto, moneda,
    distribuir, perfiles, plan, consejero, historial y reportar); en el celular
    **cambia de pestana** solo para mostrar cada panel; se navega tambien con las
    flechas y Esc y **bloquea el fondo**. Se marca como visto al terminar, al
    saltar o al guardar el primer mes (clave `gastamejor.tour.v1`), asi **no se
    repite**; se puede **relanzar** desde *Mis datos* → **🎓 Ver el tutorial
    guiado**.

## Requisitos de la web

- **Mobile-first**: se usa comodamente desde un celular (iPhone o Android),
  disenada desde 360px de ancho, botones grandes (min 48px).
- Funciona en cualquier navegador moderno, **sin servidor ni instalaciones**.
- Texto claro, en espanol, sin jerga financiera: *"escribe tu dinero y te dice
  cuanto destinar a cada gasto"*.
- La moneda se elige en la pantalla de ingreso, junto al monto (pesos
  argentinos por defecto).
- Mensajes de error y estados de exito claros (ej. porcentajes que suman 100).

## Reglas tecnicas

- Solo HTML, CSS y JavaScript vanilla (sin frameworks, sin dependencias).
- Capa de datos en `storage.js` con un adaptador: hoy guarda en localStorage y
  ofrece imagen PNG / enlace compartible + cotización del dólar cacheada +
  historial mensual + el flag del tutorial guiado (`gastamejor.tour.v1`).
  Disenada para poder cambiar a sincronizacion real mas adelante sin reescribir
  la UI.
- Separacion: `index.html` (estructura), `styles.css` (diseno con variables CSS),
  `app.js` (logica e interfaz), `storage.js` (datos).
- Nombres de variables, funciones y mensajes **en espanol**.
- Validaciones: monto numerico y positivo; porcentajes entre 0 y 100;
  montos fijos mayores o iguales a 0. Los fijos se reservan primero y los
  porcentajes se estiran sobre lo que queda: el total no supera el 100%
  (excepto cuando los fijos solos superan el ingreso, y se avisa en rojo).

## Estructura esperada

```
gastos-app/
  index.html        # Estructura de la web
  styles.css        # Sistema de diseno (tokens en :root)
  app.js            # Logica de reparto e interfaz
  storage.js        # LocalStorage + imagen/enlace + cotización del dólar
  logo.png          # Icono / logo
  tutorial.html     # Tutorial visual e interactivo (usa el ejemplo)
  datos-ejemplo.js  # Datos de ejemplo de 12 meses + cargar/borrarEjemplo()
  pruebas.html      # Panel de pruebas y datos (para chequear en el navegador)
  pruebas.js        # Suites de pruebas (se inyectan en index.html)
  tests/
    correr-tests.ps1  # Runner en Edge headless (Windows)
  README.md
  .opencode/
    opencode.jsonc
    agents/       # equipo de agentes
```

## Equipo de agentes

- **orquestador** (primario): entrevista, define requisitos y coordina.
- **analista-financiero**: disena el modelo de categorias y porcentajes.
- **arquitecto**: define la estructura y el diseno de modulos.
- **marketer-web**: experto en marketing/UX que genera la interfaz y los textos.
- **visual-designer**: define colores, tipografias y formas (sistema de diseno).
- **desarrollador**: escribe el codigo web integrando todo.
- **revisor**: revisa y prueba la web (viewport movil y escritorio).
- **consejero-financiero**: disena los consejos para llegar al objetivo de
  reparto (reglas y textos del panel Consejero).

## Flujo recomendado

`orquestador` -> `analista-financiero` -> `arquitecto` -> (`marketer-web` y
`visual-designer` en paralelo) -> `desarrollador` -> `revisor`
(volver a `desarrollador` si el revisor encuentra fallos).

## Criterios de aceptacion

- Se usa con el pulgar de una mano en el celular.
- Explica su proposito en una frase.
- Los porcentajes suman 100% y los montos positivos.
- La imagen PNG y el enlace compartible funcionan.
- El ahorro en USD se convierte con la cotización vigente (o el valor guardado).
- Los montos se escriben con puntos de miles y coma decimal.
- `tests/correr-tests.ps1` termina con código 0 (todas las pruebas pasan) y
  `pruebas.html` muestra PASS/FAIL para que el usuario lo chequee en la web.
- El botón de ejemplo del `tutorial.html` carga los 12 meses y se ven en el
  calendario del Historial; la app (`index.html`) queda intacta.