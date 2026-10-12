# GastaMejor 💸

App **web responsive** que reparte un monto de dinero entre tus categorías de
gasto (necesidades · deseos · ahorro) para que uses tu dinero de forma
eficiente.

## Cómo usarla

1. Abre `index.html` con doble clic (funciona sin instalar nada en cualquier
   navegador moderno: chrome, edge, safari, firefox). **La primera vez** (mientras
   no tengas historial) aparece un **tutorial guiado** que resalta cada botón con
   un globo explicativo; lo podés saltear y **repetir** desde *Mis datos*.
2. Escribe tu dinero del mes, elige la **moneda** (pesos argentinos por
   defecto) y pulsa **Distribuir mi dinero**.
3. Mira el reparto por categorías con **subtotales por grupo**, y ajustá tus
   **perfiles**, el **plan de evolución** y el **🧭 Consejero** desde el panel
   lateral.
4. Guardá cada mes con **📅 Guardar este mes**. El **Historial** (izquierda) y el
   panel **🎯 Perfil y plan** (derecha) quedan **siempre visibles**; en el
   celular se cambia con la **barra de pestañas** de abajo. En **Mis datos**
   descargá la **imagen PNG** o generá un **enlace** para otro equipo.

## Porcentajes y montos fijos

Cada categoría puede asignarse de dos formas (botón **% / $** en Ajustar):

- **% (porcentaje):** su **peso relativo** entre las categorías flexibles.
- **$ (monto fijo):** el monto exacto que pagas (ej. alquiler `$ 350.000`),
  no cambia aunque cambie tu ingreso.

**Regla de reparto:** los gastos fijos se reservan **primero** (son tus gastos
obligatorios). El dinero que queda se reparte entre los porcentajes en
proporción a su valor y **se estira para usar todo tu ingreso**: nunca se pasa
del 100%. Si Vivienda ocupa más de su porcentaje ideal, el resto se achica solo
para ajustarse a tus gastos obligatorios.

Los montos se escriben con el formato argentino: **1.000.000,00** (puntos de
miles y coma decimal). La app los formatea mientras escribes.

## Ahorro en dólares (cotización en vivo)

Como ahorrar en dólares es muy común en Argentina, las categorías del grupo
**Ahorro** en modo fijo **$** tienen un selector **AR$ / US$**. En **US$** el
monto se escribe en dólares y se convierte a pesos con la **cotización del día**
(el valor *venta*).

- Al abrir la app se consulta **dolarapi.com** (sin API key). El tipo de dólar
  se elige en *Ajustar*: **Bolsa (MEP)** por defecto, Blue, Oficial, Cripto o
  Tarjeta.
- **Sin conexión:** se usa la última cotización guardada (con su fecha) y
  aparece `Sin conexión · última cotización…`. También puedes **cargarla a mano**
  desde *Ajustar* → "Editar a mano / sin conexión".
- El resultado y la imagen PNG muestran el monto en **US$** junto a su
  equivalente en pesos. Disponible cuando el ingreso está en **ARS**.

## Gráfico de torta

El resultado se muestra como **gráfico de torta** (SVG, sin librerías) con un
sector por categoría y, junto a él, una **leyenda** donde cada color indica su
categoría con su % y su monto en $. Si el total no llega al 100%, aparece un
sector gris **"Sin designar"** con su % y su total en $ (y la misma fila al
final del desglose). Si tus gastos fijos superan el ingreso, el gráfico se
marca en rojo y la app te avisa cuánto te pasas.

## Paneles siempre visibles

La pantalla se organiza en **3 zonas**:

- **📅 Historial** (izquierda): tu calendario mensual y la evolución del ahorro.
- **Reparto** (centro): donde escribís el monto y ves el resultado y los ajustes.
- **🎯 Perfil + 📈 Plan + 🧭 Consejero** (derecha).

En **escritorio** las tres se ven a la vez (desde 1200px; entre 900 y 1200px el
historial pasa arriba del reparto). En el **celular** se cambia con una **barra
de pestañas**: `🧮 Reparto · 📅 Historial · 🎯 Perfil y plan`.

## Consejero: cómo llegar a tu objetivo

El **🧭 Consejero** te dice **dónde y cómo recortar** para acercarte al
**objetivo** que elijas (Gastador, Equilibrado, Conservador o Cauto). Compara el
% real de cada grupo con el objetivo y, según el **nombre de tus categorías**, da
consejos concretos:

- **Vivienda / alquiler** → negociar, compartir gastos o mudarte a algo más chico.
- **Auto / combustible** → más transporte público, viajes compartidos, home office.
- **Comida / súper** → menú semanal, lista de compras, cocinar más en casa.
- **Delivery / cafés, suscripciones, deudas, ocio y más**, cada uno con su tip.

Cada consejo muestra **cuánto** conviene bajar (en $), ordenado por impacto. Si ya
cumplís el objetivo, te lo confirma. Reemplaza al viejo panel "💡 Para gastar
mejor".

## Perfiles de reparto

En el panel **🎯 Perfil y plan** (a la derecha en escritorio, o en su pestaña en
el celular) hay **4 perfiles** que, con un toque, reparten tus porcentajes por
grupo:

| Perfil | Necesidades | Deseos | Ahorro |
|---|---|---|---|
| 🎈 Gastador | 60% | 30% | 10% |
| ⚖️ Equilibrado (ideal) | 50% | 30% | 20% |
| 🛡️ Conservador | 45% | 25% | 30% |
| 🏦 Cauto | 40% | 20% | 40% |

Tocar un perfil reparte el peso de cada grupo entre sus categorías
**porcentuales** (proporcional a lo que ya tenían). Las categorías **fijas** no
se tocan. Como el reparto se mide sobre tu **ingreso real** (incluyendo los
montos fijos), el perfil considera tus gastos obligatorios antes de repartir. La
app además **detecta tu perfil actual** ("Tu perfil actual: …") según cómo queda
tu reparto, y la lista de categorías se **agrupa por grupo** (Necesidades ·
Deseos · Ahorro).

## Plan de evolución

Junto a los perfiles, el **Plan de evolución** te lleva de a poco al ideal
50/30/20: elegís en **cuántos meses** querés llegar (3 a 12) y la app calcula el
paso. Muestra una línea de tiempo (`Hoy → Mes 1 → … → Ideal`) donde **Hoy** es tu
reparto real (incluye los montos fijos, por eso también se ve el azul de
Necesidades) y cada fila proyecta cómo quedaría el % de ahorro.

El botón **Aplicar próximo paso** avanza en **pasos lineales**: con el slider en
**N** meses, **N toques** te llevan exactamente al ideal. Cada toque guarda el
punto de partida y muestra **cuánto cambia** cada categoría: `+5 pt` en verde o
`-3 pt` en rojo junto al porcentaje, y el mismo `+/-` junto al **monto** que
representa, tanto en *Resultado* como en *Ajustar* (los deltas se limpian cuando
editás a mano). Si una parte de tu ingreso está en montos fijos, el plan avisa
qué grupo no puede bajar del ideal solo con porcentajes.

## Historial financiero

El **📅 Historial** está **siempre visible** en la columna izquierda (en el
celular, en su pestaña). Incluye:

- Un **calendario** del año con el **monto** de cada mes (flechas ← → para
  cambiar de año). El monto va **abreviado** para que entre prolijo en cada
  recuadro: `1.2M`, `850K`, `1.5K`, `850`. El detalle del mes sí lo muestra
  completo (`$ 1.200.000`).
- Al tocar un mes: su **gráfico de torta**, los **subtotales por grupo** y el
  **perfil** de ese mes.
- Un gráfico de **evolución del ahorro** mes a mes, con la línea del ideal 20%,
  para ver cómo mejorás con el tiempo.

Desde el resultado, el botón **📅 Guardar este mes** guarda (o actualiza) el mes
en curso con tu reparto actual. El historial queda guardado en el dispositivo,
no viaja en el enlace compartible.

## Imagen PNG

En "Mis datos" → **📸 Descargar imagen (PNG)** se descarga `gastamejor-reparto.png`:
una tarjeta con tu reparto (torta con los mismos colores, % en el centro,
ingreso y total, desglose por grupos con subtotales y avisos de exceso o "Sin
designar") lista para compartir por WhatsApp o redes. Se genera con **canvas
propio, sin librerías**, y funciona offline.

## Catálogo de categorías

En *Ajustar* → **📖 Agregar del catálogo** encuentras sugerencias argentinas
listas para tocar (no se duplican): Alquiler/expensas, Servicios, Súper,
**Combustible del auto**, **Colectivo/SUBE**, **Taxi/remis**, Prepaga, Salud,
Educación, Deudas, Ocio, Delivery, Suscripciones, Ahorro y más. Si no tienes
auto, borras Combustible y usas Colectivo. ✕ sobre cada fila la elimina.

> 💡 Desde el celular: puedes subir la carpeta a Netlify Drop o GitHub Pages y
> abrir el enlace desde el navegador del teléfono (iPhone o Android).

## Sincronizar entre dispositivos

- **Enlace:** en "Mis datos" → "Enlace para otro dispositivo". Abre ese enlace
  en otro equipo y pulsa **Aceptar** al aviso: se usa la misma distribución.
- **Imagen PNG:** en "Mis datos" → "Descargar imagen (PNG)" bajas una imagen
  con tu reparto lista para compartir o guardar.

Los datos se guardan en el dispositivo (localStorage). La capa `storage.js`
está preparada para conectar a una sincronización real (API/cloud) sin
reescribir la interfaz.

## Reportar un problema

Abajo a la derecha hay un **botón flotante 🐞 Reportar** (siempre visible). Al
tocarlo abre **WhatsApp** con el chat **+54 9 2920553198** y el mensaje ya
escrito *"Encontre un problema en GastaMejor: "* para que completes qué pasó.

## Tutorial guiado de primera vez

La **primera vez** que abrís la app (cuando todavía **no guardaste ningún mes**)
arranca un **tutorial guiado** estilo juego: oscurece el fondo, **resalta un
botón** y muestra un **globo** con para qué sirve y qué utilidad le podés sacar.
Recorre **8 pasos**: dinero del mes, moneda, distribuir, perfiles, plan de
evolución, consejero, historial y el botón de reportar.

- Se navega con **Siguiente / Anterior**, o **Saltar**; también con las flechas
  **← →** y **Esc**.
- En el **celular** cambia solo de pestaña para mostrarte cada panel.
- **No se repite**: se marca como visto al terminar, al saltearlo o al guardar tu
  primer mes. Para volver a verlo, andá a **Mis datos → 🎓 Ver el tutorial
  guiado** (y ahí mismo tenés **📖 Abrir el tutorial completo**,
  `tutorial.html`).

## Reparto sugerido

| Grupo | Categoría | % |
|---|---|---|
| Necesidades (50%) | Vivienda | 25% |
| Necesidades | Comida y súper | 15% |
| Necesidades | Transporte | 10% |
| Deseos (30%) | Ocio y planes | 15% |
| Deseos | Compras personales | 15% |
| Ahorro (20%) | Ahorro | 15% |
| Ahorro | Fondo de emergencia | 5% |

## Tutorial, datos de ejemplo y pruebas

La carpeta incluye tres páginas extra (**no forman parte de la app**: no tocan
`index.html`, `app.js`, `storage.js` ni `styles.css`).

### 🎓 `tutorial.html` — tutorial visual e interactivo

- Explica **todos** los pasos: escribir el monto y la moneda, leer el resultado,
  ajustar (% / $ y US$), perfiles, plan de evolución, Consejero, historial,
  PNG y enlace.
- Incluye **"La historia de Ana"**: un ejemplo de **12 meses** (2026) donde
  alguien pasa de **Gastador 60/30/10** a **Equilibrado 50/30/20**, con el
  ahorro creciendo, una tabla y un **mini-gráfico** de la evolución.
- Botón **▶️ Probar con el ejemplo**: carga los 12 meses en el navegador y abre
  la app (el botón vive solo acá; la app queda intacta).

### 🧪 `pruebas.html` — pruebas a un clic (para chequear vos mismo)

- Corre **todas las funciones de la app** en tu navegador y muestra el reporte:
  **PASS / FAIL / TOTAL** por suite (formato de montos, reparto, perfiles, plan,
  deltas, Consejero, historial, storage/enlace, navegación, etc.).
- Muestra la tabla de los **12 meses del ejemplo** y su **JSON**.
- Botones: **cargar ejemplo**, **abrir la app**, **borrar ejemplo**, **copiar
  JSON**.
- Hay que abrirlo con un **servidor local** o desde la web publicada (para que
  el marco funcione por el *mismo origen*).

### ⌨️ `tests/correr-tests.ps1` — automatización (Windows)

Levanta un servidor local, abre `pruebas.html` en **Edge headless**, lee el
resultado y sale con código **0** (todo bien) / **1** (fallos).

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\correr-tests.ps1
```

### 🅰️ `datos-ejemplo.js` — los datos del ejemplo

Define `EJEMPLO_PROGRESO` (12 meses), `EJEMPLO_CONFIG`, `cargarEjemplo()` y
`borrarEjemplo()`. Lo comparten `tutorial.html` y `pruebas.html`.

## Archivos

```
index.html        Estructura de la web
styles.css        Sistema de diseño (tokens CSS, mobile-first)
app.js            Lógica de reparto e interfaz
storage.js        LocalStorage + imagen/PNG + enlace + cotización del dólar
logo.png          Ícono / logo
tutorial.html     Tutorial visual e interactivo (con el ejemplo de 12 meses)
datos-ejemplo.js  Datos de ejemplo (12 meses) + cargarEjemplo()/borrarEjemplo()
pruebas.html      Panel de pruebas y de datos de ejemplo (para chequear)
pruebas.js        Suites de pruebas (se inyectan dentro de la app)
tests/correr-tests.ps1  Runner en Edge headless (opcional, Windows)
```

## Desarrollo

Proyecto gestionado por el equipo de agentes en `.opencode/agents/`
(orquestador, analista-financiero, arquitecto, marketer-web, visual-designer,
desarrollador, revisor, consejero-financiero). Detalles en `AGENTS.md`.

Sin dependencias: solo HTML, CSS y JavaScript vanilla.