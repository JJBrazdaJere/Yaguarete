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
   designar"** si el total no llega al 100% del ingreso) y recomendaciones
   **"Para gastar mejor"** basadas en el ideal 50/30/20.
4. Cada categoría puede ser **%** (peso relativo que se estira para usar todo
   el ingreso) o **$** (monto fijo, ej. alquiler) mediante un interruptor en la
   pantalla Ajustar. Los fijos se reservan primero y el resto se reparte entre
   los porcentajes.
5. Permite ajustar, agregar y eliminar categorías, con un **catálogo de
   sugerencias argentinas** (incluye transporte con y sin auto).
6. Los datos se guardan en el dispositivo (localStorage) y se pueden
   **exportar como imagen PNG** (tarjeta con el reparto), **importar** (archivo
   JSON de versiones anteriores) o compartir con un **enlace** que codifica la
   configuracion.

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
  ofrece exportar/importar/enlace compartible. Disenada para poder cambiar a
  sincronizacion real mas adelante sin reescribir la UI.
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
  index.html      # Estructura de la web
  styles.css      # Sistema de diseno (tokens en :root)
  app.js          # Logica de reparto e interfaz
  storage.js      # LocalStorage + exportar/importar/enlace
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

## Flujo recomendado

`orquestador` -> `analista-financiero` -> `arquitecto` -> (`marketer-web` y
`visual-designer` en paralelo) -> `desarrollador` -> `revisor`
(volver a `desarrollador` si el revisor encuentra fallos).

## Criterios de aceptacion

- Se usa con el pulgar de una mano en el celular.
- Explica su proposito en una frase.
- Los porcentajes suman 100% y los montos positivos.
- Exportar, importar y enlace compartible funcionan.