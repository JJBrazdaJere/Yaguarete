# GastaMejor 💸

App **web responsive** que reparte un monto de dinero entre tus categorías de
gasto (necesidades · deseos · ahorro) para que uses tu dinero de forma
eficiente.

## Cómo usarla

1. Abre `index.html` con doble clic (funciona sin instalar nada en cualquier
   navegador moderno: chrome, edge, safari, firefox).
2. Escribe tu dinero del mes, elige la **moneda** (pesos argentinos por
   defecto) y pulsa **Distribuir mi dinero**.
3. Mira el reparto por categorías con **subtotales por grupo**, ajústalo si
   quieres y **Guardar**.
4. En **Mis datos**: descarga la **imagen PNG** con tu reparto o genera un
   **enlace** para llevarlo a otro celular o PC (la moneda se elige junto al
   monto).

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

## Gráfico de torta

El resultado se muestra como **gráfico de torta** (SVG, sin librerías) con un
sector por categoría y, junto a él, una **leyenda** donde cada color indica su
categoría con su % y su monto en $. Si el total no llega al 100%, aparece un
sector gris **"Sin designar"** con su % y su total en $ (y la misma fila al
final del desglose). Si tus gastos fijos superan el ingreso, el gráfico se
marca en rojo y la app te avisa cuánto te pasas.

## Subtotales y recomendaciones

Cada grupo (**Necesidades · Deseos · Ahorro**) muestra su **subtotal** en $ y
su **% real del ingreso**. Debajo del resultado, el panel **💡 Para gastar
mejor** compara tu reparto con el ideal 50/30/20 y te da consejos: si tus
gastos fijos superan el ~55% de tu ingreso (con cuánto deberían quedarse),
si ahorrás de menos o si te queda dinero "sin designar". En pantallas anchas
(≥900px) el panel aparece **a la derecha** del resultado; en el celular va al
final, como tarjeta.

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
- **Importar:** desde "Mis datos" puedes importar un archivo JSON guardado por
  versiones anteriores de la app (compatibilidad).

Los datos se guardan en el dispositivo (localStorage). La capa `storage.js`
está preparada para conectar a una sincronización real (API/cloud) sin
reescribir la interfaz.

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

## Archivos

```
index.html    Estructura de la web
styles.css    Sistema de diseño (tokens CSS, mobile-first)
app.js        Lógica de reparto e interfaz
storage.js    LocalStorage + exportar/importar/enlace
```

## Desarrollo

Proyecto gestionado por el equipo de agentes en `.opencode/agents/`
(orquestador, analista-financiero, arquitecto, marketer-web, visual-designer,
desarrollador, revisor). Detalles en `AGENTS.md`.

Sin dependencias: solo HTML, CSS y JavaScript vanilla.
