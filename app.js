/* GastaMejor - interfaz y logica de reparto */
"use strict";

/* ============================================================
   GastaMejor — Interfaz y logica de reparto (app.js)
   ============================================================ */

const $ = function (selector) {
  return document.querySelector(selector);
};

const GRUPOS = ["necesidad", "deseo", "ahorro"];
const ETIQUETAS_GRUPO = {
  necesidad: "Necesidades",
  deseo: "Deseos",
  ahorro: "Ahorro",
};

const estado = {
  config: null,
  monto: 0,
  cotizacion: null,
  cotizacionManual: false,
};

/* Paleta estable para el gráfico de torta (un color por categoría, en orden). */
const COLORES = [
  "#0284c7", "#d97706", "#10b981", "#6366f1", "#ec4899", "#06b6d4",
  "#84cc16", "#f97316", "#8b5cf6", "#14b8a6", "#e11d48", "#a3e635",
];
const GRIS_SIN_DESIGNAR = "#94a3b8";

/* ---------- Utilidades ---------- */

function esc(texto) {
  return String(texto).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function dinero(moneda, cantidad) {
  try {
    const locale = moneda === "ARS" ? "es-AR" : "es";
    return new Intl.NumberFormat(locale, { style: "currency", currency: moneda }).format(cantidad);
  } catch (_) {
    return "$ " + Number(cantidad).toFixed(2);
  }
}

/* Formato compacto, solo para el calendario del Historial.
   Ej.: 1.2M · 850K · 1.5K · 850. Sin simbolo de moneda. */
function dineroCorto(cantidad) {
  const n = Number(cantidad);
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const signo = n < 0 ? "-" : "";
  const unDecimal = function (v) {
    return (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
  };
  if (abs >= 1000000) {
    return signo + unDecimal(abs / 1000000) + "M";
  }
  if (abs >= 1000) {
    const miles = abs / 1000;
    let v = miles >= 100 ? String(Math.round(miles)) : unDecimal(miles);
    if (Number(v) >= 1000) return signo + "1M"; // 999.999 -> 1M (no 1000K)
    return signo + v + "K";
  }
  return signo + String(Math.round(abs));
}

function fmtPct(p) {
  const n = Number(p === undefined || p === null ? 0 : p);
  return (Math.round(n * 10) / 10).toLocaleString("es") + "%";
}

let temporizadorToast = null;
function toast(mensaje) {
  const t = $("#toast");
  t.textContent = mensaje;
  t.hidden = false;
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(function () {
    t.hidden = true;
  }, 2600);
}

/* ---------- Formato de montos (1.000.000,00) ----------
   Los puntos son separador de miles y la coma es decimal, como se
   escriben los numeros en Argentina. */

/* Separa lo escrito en parte entera y decimal (o null si no hay decimal). */
function analizarEntrada(texto) {
  const s = String(texto).replace(/[^\d.,]/g, "");
  const iComa = s.lastIndexOf(",");
  if (iComa !== -1) {
    return {
      entero: s.slice(0, iComa).replace(/\D/g, ""),
      dec: s.slice(iComa + 1).replace(/\D/g, "").slice(0, 2),
    };
  }
  const iDot = s.lastIndexOf(".");
  if (iDot !== -1) {
    const cola = s.slice(iDot + 1);
    const puntos = (s.match(/\./g) || []).length;
    if (puntos === 1 && cola.length <= 2) {
      return { entero: s.slice(0, iDot).replace(/\D/g, ""), dec: cola.replace(/\D/g, "") };
    }
    return { entero: s.replace(/\D/g, ""), dec: null };
  }
  return { entero: s.replace(/\D/g, ""), dec: null };
}

/* Formatea en vivo mientras se escribe: 1.000.000,00 */
function formatearEntradaMonto(texto) {
  const a = analizarEntrada(texto);
  const entero = a.entero.replace(/^0+(?=\d)/, "");
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (a.dec === null) return agrupado;
  return (agrupado === "" ? "0" : agrupado) + "," + a.dec;
}

/* Numero a partir de lo escrito. null si no hay ningun digito. */
function parsearEntradaMonto(texto) {
  const a = analizarEntrada(texto);
  if (a.entero === "" && (a.dec === null || a.dec === "")) return null;
  const n = Number((a.entero || "0") + "." + (a.dec || "0"));
  return isFinite(n) ? n : null;
}

/* Numero formateado con separador de miles y decimales fijos. */
function formatearNumeroMonto(n, decimales) {
  const dec = decimales === undefined ? 2 : decimales;
  const negativo = n < 0;
  const partes = Math.abs(Number(n) || 0).toFixed(dec).split(".");
  const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (negativo ? "-" : "") + entero + (dec > 0 ? "," + partes[1] : "");
}

/* Reformatea el valor de un input de monto sin perder el cursor. */
function aplicarFormatoMonto(input) {
  const antes = input.value;
  const caret = input.selectionStart === null ? antes.length : input.selectionStart;
  let significativos = 0;
  for (let i = 0; i < caret && i < antes.length; i++) {
    if (/[\d,]/.test(antes[i])) significativos++;
  }
  const despues = formatearEntradaMonto(antes);
  if (despues === antes) return;
  input.value = despues;
  let pos = 0;
  let contados = 0;
  while (pos < despues.length && contados < significativos) {
    if (/[\d,]/.test(despues[pos])) contados++;
    pos++;
  }
  try { input.setSelectionRange(pos, pos); } catch (_) { /* sin seleccion */ }
}

/* Completa con 2 decimales al salir del campo. */
function completarMonto(input) {
  const n = parsearEntradaMonto(input.value);
  input.value = n === null ? "" : formatearNumeroMonto(n, 2);
}

/* ---------- Cotizacion del dolar (ahorro en USD) ---------- */

/* Una categoria se carga en dolares solo si: ingreso en ARS, es fija y del grupo Ahorro. */
function categoriaEnUSD(cfg, c) {
  if (!cfg || cfg.moneda !== "ARS") return false;
  return c.modo === "fijo" && (c.grupo || "necesidad") === "ahorro" && c.monedaMonto === "USD";
}

function puedeCargarUSD(cfg, c) {
  if (!cfg || cfg.moneda !== "ARS") return false;
  return c.modo === "fijo" && (c.grupo || "necesidad") === "ahorro";
}

function hayAhorroUSD(cfg) {
  return !!cfg && cfg.categorias.some(function (c) { return categoriaEnUSD(cfg, c); });
}

function tasaCotizacion() {
  return estado.cotizacion && Number(estado.cotizacion.valor) > 0 ? Number(estado.cotizacion.valor) : 0;
}

function nombreDolarActual() {
  const tipo = (estado.cotizacion && estado.cotizacion.tipo) || (estado.config && estado.config.dolarTipo) || "bolsa";
  return typeof nombreDolar === "function" ? nombreDolar(tipo) : "Dólar";
}

function fechaCorta(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch (_) {
    return "";
  }
}

/* ---------- Logica de reparto ----------
   Regla: los montos fijos se reservan PRIMERO (son los gastos
   obligatorios). El dinero que queda se reparte entre las
   categorias porcentuales en proporcion a su %, se estira para
   usar todo el ingreso. Asi el total nunca supera el 100%
   (salvo que los fijos solos superen el ingreso). */

function calcularReparto(cfg, ingreso, cotizacion) {
  const cot = cotizacion || estado.cotizacion;
  const tasa = cot && Number(cot.valor) > 0 ? Number(cot.valor) : 0;
  const valorDe = function (c) {
    const monto = Number(c.monto) || 0;
    return categoriaEnUSD(cfg, c) ? monto * tasa : monto;
  };
  const sumaFijos = cfg.categorias.reduce(function (acum, c) {
    return c.modo === "fijo" ? acum + valorDe(c) : acum;
  }, 0);
  const sumaPct = cfg.categorias.reduce(function (acum, c) {
    return c.modo === "porcentaje" ? acum + (Number(c.porcentaje) || 0) : acum;
  }, 0);
  const disponible = ingreso - sumaFijos;

  const montoCategoria = cfg.categorias.map(function (c) {
    if (c.modo === "fijo") return valorDe(c);
    if (disponible <= 0 || sumaPct <= 0) return 0;
    return disponible * ((Number(c.porcentaje) || 0) / sumaPct);
  });

  const asignado = montoCategoria.reduce(function (a, b) { return a + b; }, 0);
  return {
    montoCategoria: montoCategoria,
    sumaFijos: sumaFijos,
    sumaPct: sumaPct,
    disponible: disponible,
    asignado: asignado,
    restante: ingreso - asignado,
    pctTotal: ingreso > 0 ? (asignado / ingreso) * 100 : 0,
  };
}

/* ---------- Navegacion entre pantallas y zonas ----------
   El tablero tiene 3 zonas siempre visibles en escritorio
   (historial | reparto | perfil-plan-consejero). En el celular se
   muestra una sola zona y se cambia con la barra de pestañas. */

let pestanaActiva = "reparto";

function mostrarPestana(tab) {
  pestanaActiva = tab;
  const tablero = $("#tablero");
  if (tablero) tablero.setAttribute("data-tab", tab);
  document.querySelectorAll(".tabbar-btn").forEach(function (b) {
    b.classList.toggle("activo", b.dataset.tab === tab);
  });
  if (tab === "historial") renderHistorial();
  actualizarBotonAtras();
  window.scrollTo({ top: 0 });
}

function actualizarBotonAtras() {
  const btn = $("#btn-atras");
  if (!btn) return;
  if (pestanaActiva !== "reparto") { btn.hidden = false; return; }
  const actual = document.querySelector(".zona-reparto .pantalla:not([hidden])");
  const nombre = actual ? actual.getAttribute("data-pantalla") : "ingreso";
  btn.hidden = nombre === "ingreso";
}

function pantallaRepartoActual() {
  const actual = document.querySelector(".zona-reparto .pantalla:not([hidden])");
  return actual ? actual.getAttribute("data-pantalla") : "ingreso";
}

function mostrarPantalla(nombre) {
  document.querySelectorAll(".zona-reparto [data-pantalla]").forEach(function (sec) {
    sec.hidden = sec.getAttribute("data-pantalla") !== nombre;
  });
  if (pestanaActiva !== "reparto") mostrarPestana("reparto");
  if (nombre === "resultado") renderResultado();
  else if (nombre === "ajustar") renderAjustar();
  actualizarPanelLateral();
  actualizarBotonAtras();
  window.scrollTo({ top: 0 });
}

/* ---------- Pantalla 1: ingreso ---------- */

function distribuir() {
  const monto = parsearEntradaMonto($("#monto").value);
  const error = $("#error-monto");
  if (monto === null || !isFinite(monto) || monto <= 0) {
    error.hidden = false;
    $("#monto").focus();
    return;
  }
  error.hidden = true;
  estado.monto = monto;
  reiniciarPlan();
  mostrarPantalla("resultado");
}

/* ---------- Pantalla 2: resultado ---------- */

function renderResultado() {
  const monto = estado.monto;
  const cfg = estado.config;
  const reparto = calcularReparto(cfg, monto);

  $("#resumen-ingreso").textContent = dinero(cfg.moneda, monto);
  $("#resumen-repartido").textContent = dinero(cfg.moneda, reparto.asignado);

  const aviso = $("#aviso-suma");
  if (reparto.restante < -0.01) {
    aviso.className = "aviso aviso-error";
    aviso.innerHTML =
      "Tus gastos fijos superan tu ingreso por <strong>" +
      dinero(cfg.moneda, -reparto.restante) +
      "</strong>. Bajá esos montos o aumentá tu ingreso.";
  } else if (reparto.restante > 0.01) {
    aviso.className = "aviso aviso-aviso";
    aviso.innerHTML =
      "Sin categorías porcentuales activas: te quedan <strong>" +
      dinero(cfg.moneda, reparto.restante) +
      "</strong> sin repartir <em>(Sin designar)</em>.";
  } else {
    aviso.className = "aviso aviso-ok";
    aviso.innerHTML = "Reparto completo: usas el 100% de tu ingreso <strong>💪</strong>";
  }

  renderGrafico(reparto, cfg, monto);

  const contenedor = $("#resultado-lista");
  contenedor.innerHTML = "";

  GRUPOS.forEach(function (grupo) {
    const items = cfg.categorias.filter(function (c) {
      return (c.grupo || "necesidad") === grupo;
    });
    if (!items.length) return;

    let sumaGrupo = 0;
    items.forEach(function (c) {
      sumaGrupo += reparto.montoCategoria[cfg.categorias.indexOf(c)];
    });
    const pctGrupo = monto > 0 ? (sumaGrupo / monto) * 100 : 0;

    const bloque = document.createElement("section");
    bloque.className = "grupo";

    const titulo = document.createElement("h3");
    titulo.className = "grupo-titulo";
    titulo.innerHTML =
      '<span class="chip chip-' + grupo + '" aria-hidden="true"></span>' +
      '<span class="grupo-titulo-texto">' + ETIQUETAS_GRUPO[grupo] + "</span>" +
      '<span class="grupo-subtotal grupo-subtotal-' + grupo + '">' +
      dinero(cfg.moneda, sumaGrupo) + " · " + fmtPct(pctGrupo) +
      "</span>";
    bloque.appendChild(titulo);

    items.forEach(function (c) {
      const index = cfg.categorias.indexOf(c);
      const montoCategoria = reparto.montoCategoria[index];
      const pctEquiv = monto > 0 ? (montoCategoria / monto) * 100 : 0;
      const montoHTML = categoriaEnUSD(cfg, c)
        ? dinero(cfg.moneda, montoCategoria) +
          '<span class="fila-monto-usd">US$ ' + formatearNumeroMonto(Number(c.monto) || 0, 2) + "</span>"
        : dinero(cfg.moneda, montoCategoria);
      const fila = document.createElement("div");
      fila.className = "fila";
      const delta = planDeltas ? planDeltas[index] : null;
      fila.innerHTML =
        '<span class="fila-dot" style="background:' + colorDeCategoria(index) + '" aria-hidden="true"></span>' +
        '<div class="fila-info">' +
        '<span class="fila-nombre">' + esc(c.nombre) + "</span>" +
        '<span class="fila-pct">' + fmtPct(pctEquiv) +
          (delta ? badgeDelta(fmtDeltaPt(delta.dreal), delta.dreal) : "") + "</span>" +
        "</div>" +
        '<span class="fila-monto">' + montoHTML +
          (delta ? badgeDelta(fmtDeltaDinero(cfg.moneda, delta.dmonto), delta.dmonto) : "") + "</span>";
      bloque.appendChild(fila);
    });

    contenedor.appendChild(bloque);
  });

  if (reparto.restante > 0.01) {
    const fila = document.createElement("div");
    fila.className = "fila fila-sin-designar";
    fila.innerHTML =
      '<span class="fila-dot" style="background:' + GRIS_SIN_DESIGNAR + '" aria-hidden="true"></span>' +
      '<div class="fila-info">' +
      '<span class="fila-nombre">Sin designar</span>' +
      '<span class="fila-pct">' + fmtPct((reparto.restante / monto) * 100) + "</span>" +
      "</div>" +
      '<span class="fila-monto">' + dinero(cfg.moneda, reparto.restante) + "</span>";
    contenedor.appendChild(fila);
  }

  renderCotizacion();
}

/* ---------- Grafico de torta (SVG sin dependencias) ---------- */

function colorDeCategoria(index) {
  return COLORES[index % COLORES.length];
}

function renderGrafico(reparto, cfg, ingreso) {
  const cont = $("#grafico");
  if (!cont) return;

  const exceso = reparto.restante < -0.01;
  const incompleto = reparto.restante > 0.01;
  cont.className =
    "grafico" + (exceso ? " grafico-exceso" : incompleto ? " grafico-incompleto" : "");

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 200 200");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Gráfico de torta del reparto de gastos");
  svg.classList.add("grafico-svg");

  const cx = 100;
  const cy = 100;
  const r = 74;
  const ancho = 30;

  // Anillo de fondo (base)
  const base = document.createElementNS(svgNS, "circle");
  base.setAttribute("cx", cx);
  base.setAttribute("cy", cy);
  base.setAttribute("r", r);
  base.setAttribute("fill", "none");
  base.setAttribute("stroke", exceso ? "#fee2e2" : "#e2e8f0");
  base.setAttribute("stroke-width", ancho);
  svg.appendChild(base);

  // En exceso se normaliza al total asignado (no se puede pasar del 100%).
  const totalBase = exceso ? reparto.asignado : ingreso;
  const segmentos = [];
  cfg.categorias.forEach(function (c, i) {
    const monto = reparto.montoCategoria[i];
    const frac = totalBase > 0 ? monto / totalBase : 0;
    if (frac > 0.0005) {
      segmentos.push({ frac: frac, color: colorDeCategoria(i) });
    }
  });
  if (incompleto && ingreso > 0) {
    segmentos.push({ frac: reparto.restante / ingreso, color: GRIS_SIN_DESIGNAR });
  }

  const C = 2 * Math.PI * r;
  let gradosAcumulados = 0;
  segmentos.forEach(function (seg) {
    const largo = seg.frac * C;
    const circ = document.createElementNS(svgNS, "circle");
    circ.setAttribute("cx", cx);
    circ.setAttribute("cy", cy);
    circ.setAttribute("r", r);
    circ.setAttribute("fill", "none");
    circ.setAttribute("stroke", seg.color);
    circ.setAttribute("stroke-width", ancho);
    circ.setAttribute("stroke-dasharray", largo.toFixed(3) + " " + (C - largo).toFixed(3));
    circ.setAttribute("transform", "rotate(" + (gradosAcumulados - 90).toFixed(2) + " " + cx + " " + cy + ")");
    svg.appendChild(circ);
    gradosAcumulados += seg.frac * 360;
  });

  const texto = document.createElementNS(svgNS, "text");
  texto.setAttribute("x", cx);
  texto.setAttribute("y", cy - 2);
  texto.setAttribute("text-anchor", "middle");
  texto.classList.add("grafico-centro");
  texto.textContent = fmtPct(reparto.pctTotal);
  svg.appendChild(texto);

  const sub = document.createElementNS(svgNS, "text");
  sub.setAttribute("x", cx);
  sub.setAttribute("y", cy + 16);
  sub.setAttribute("text-anchor", "middle");
  sub.classList.add("grafico-sub");
  sub.textContent = "del ingreso";
  svg.appendChild(sub);

  cont.innerHTML = "";
  cont.appendChild(svg);

  // Leyenda: qué color representa cada categoría.
  const leyenda = document.createElement("div");
  leyenda.className = "grafico-leyenda";
  leyenda.setAttribute("aria-label", "Leyenda del gráfico");
  cfg.categorias.forEach(function (c, i) {
    const monto = reparto.montoCategoria[i];
    const fila = document.createElement("div");
    fila.className = "grafico-leyenda-fila";
    fila.innerHTML =
      '<span class="grafico-leyenda-dot" style="background:' + colorDeCategoria(i) + '" aria-hidden="true"></span>' +
      '<span class="grafico-leyenda-nombre">' + esc(c.nombre) + "</span>" +
      '<span class="grafico-leyenda-dato">' +
      fmtPct(ingreso > 0 ? (monto / ingreso) * 100 : 0) + " · " +
      dinero(cfg.moneda, monto) +
      "</span>";
    leyenda.appendChild(fila);
  });
  if (reparto.restante > 0.01) {
    const fila = document.createElement("div");
    fila.className = "grafico-leyenda-fila";
    fila.innerHTML =
      '<span class="grafico-leyenda-dot" style="background:' + GRIS_SIN_DESIGNAR + '" aria-hidden="true"></span>' +
      '<span class="grafico-leyenda-nombre">Sin designar</span>' +
      '<span class="grafico-leyenda-dato">' +
      fmtPct((reparto.restante / ingreso) * 100) + " · " +
      dinero(cfg.moneda, reparto.restante) +
      "</span>";
    leyenda.appendChild(fila);
  }
  cont.appendChild(leyenda);
}

/* ---------- Subtotales por grupo ---------- */

const IDEAL_GRUPO = { necesidad: 50, deseo: 30, ahorro: 20 };

function calcularSubtotalesGrupo(reparto, cfg) {
  const porGrupo = { necesidad: 0, deseo: 0, ahorro: 0 };
  cfg.categorias.forEach(function (c, i) {
    porGrupo[c.grupo || "necesidad"] += reparto.montoCategoria[i];
  });
  return porGrupo;
}

/* ============================================================
   Consejero: consejos para llegar al objetivo
   ------------------------------------------------------------
   Compara el reparto real de cada grupo con el perfil objetivo
   elegido y sugiere, categoria por categoria, donde y como
   recortar. Los tips salen del nombre de la categoria (palabras
   clave), asi que funcionan aunque la categoria sea personalizada.
   ============================================================ */

const CONSEJOS_CATEGORIA = [
  { claves: ["alquiler", "vivienda", "expensas", "hipoteca", "departamento", "casa", "terreno"],
    accion: "negociá el alquiler o las expensas, compartí gastos con alguien o evaluá mudarte a algo más chico." },
  { claves: ["combustible", "nafta", "auto", "coche", "seguro", "patente", "estacionamiento", "peaje", "moto"],
    accion: "usá más transporte público, compartí viajes o combiná días de home office para no usar tanto el vehículo." },
  { claves: ["comida", "super", "supermercado", "almacen", "mercado", "verduleria", "carniceria", "almacén"],
    accion: "planificá el menú semanal, comprá con lista y aprovechá las ofertas; cociná más en casa." },
  { claves: ["delivery", "cafe", "café", "restaurante", "bar", "pedidos", "take away"],
    accion: "bajá los pedidos a domicilio y los cafés fuera de casa; reservalos para ocasiones especiales." },
  { claves: ["suscripcion", "suscripción", "streaming", "netflix", "spotify", "cable", "gimnasio", "app"],
    accion: "revisá cuáles usás de verdad y cancelá las que no; compartí cuentas familiares." },
  { claves: ["deuda", "tarjeta", "prestamo", "préstamo", "credito", "crédito", "cuota"],
    accion: "priorizá las deudas de mayor interés y evitá nuevas cuotas mientras las pagás." },
  { claves: ["ocio", "entretenimiento", "juego", "fiesta", "salida", "salidas"],
    accion: "buscá planes gratuitos o más baratos y ponete un tope semanal." },
  { claves: ["transporte", "colectivo", "sube", "tren", "subte", "taxi", "remis"],
    accion: "combiná el abono mensual y caminá o pedaleá los tramos cortos." },
  { claves: ["ropa", "compras", "calzado", "tecnologia", "tecnología", "electronica", "electrónica"],
    accion: "esperá las ofertas, comprá de segunda mano o repará antes de reemplazar." },
  { claves: ["viaje", "vacacion", "vacación", "turismo"],
    accion: "viajá fuera de temporada, en cuotas sin interés o elegí destinos más cercanos." },
  { claves: ["servicios", "luz", "gas", "agua", "internet", "telefono", "teléfono", "celular"],
    accion: "revisá el consumo, pasá a planes más bajos y pagá a tiempo para evitar recargos." },
  { claves: ["salud", "obra social", "prepaga", "farmacia", "medico", "médico"],
    accion: "compará planes, usá genéricos cuando puedas y aprovechá los reintegros." },
];

/* Normaliza para comparar (minusculas, sin acentos). */
function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function accionParaCategoria(nombre) {
  const n = normalizarTexto(nombre);
  for (let i = 0; i < CONSEJOS_CATEGORIA.length; i++) {
    const regla = CONSEJOS_CATEGORIA[i];
    for (let j = 0; j < regla.claves.length; j++) {
      if (n.indexOf(normalizarTexto(regla.claves[j])) !== -1) return regla.accion;
    }
  }
  return "revisá este gasto y buscá una alternativa más económica o negociá el precio.";
}

/* Devuelve una lista de consejos para acercar el reparto al objetivo. */
function consejosConsejero(cfg, ingreso) {
  const moneda = cfg.moneda;
  const objetivo = buscarPerfil(cfg && cfg.objetivo) || buscarPerfil("equilibrado");
  const salida = [];

  if (ingreso <= 0) {
    salida.push({
      tipo: "aviso",
      titulo: "Falta tu ingreso",
      texto: "Escribí tu dinero del mes y el consejero te dirá cómo acercarte a <strong>" +
        esc(objetivo.nombre) + "</strong>.",
    });
    return salida;
  }

  const reparto = calcularReparto(cfg, ingreso);
  if (reparto.restante < -0.01) {
    salida.push({
      tipo: "error",
      titulo: "Te pasaste del ingreso",
      texto: "Tus gastos fijos superan tu ingreso por <strong>" + dinero(moneda, -reparto.restante) +
        "</strong>. Bajá esos montos o aumentá tu ingreso antes de buscar el objetivo.",
    });
    return salida;
  }

  const dist = distribucionActualGrupo(cfg, ingreso);
  const porGrupo = calcularSubtotalesGrupo(reparto, cfg);
  const actual = perfilActual(cfg, ingreso);

  salida.push({
    tipo: "objetivo",
    titulo: "Objetivo: " + objetivo.emoji + " " + objetivo.nombre,
    texto: "Hoy estás en <strong>" + esc(actual ? actual.emoji + " " + actual.nombre : "—") +
      "</strong>. Para llegar al objetivo, mirá estos consejos:",
  });

  if (reparto.restante > 0.01) {
    salida.push({
      tipo: "aviso",
      titulo: "Sin designar",
      texto: "Te quedan <strong>" + dinero(moneda, reparto.restante) +
        "</strong> sin repartir. Destinalos al ahorro para acercarte al objetivo.",
    });
  }

  let huboRecorte = false;

  GRUPOS.forEach(function (grupo) {
    const objetivoPct = objetivo.grupos[grupo];
    const brecha = objetivoPct - dist[grupo];

    // En ahorro nunca se recorta: ahorrar de más nunca es un problema.
    if (grupo === "ahorro") {
      if (brecha > 1) {
        const falta = (brecha / 100) * ingreso;
        salida.push({
          tipo: "ahorro",
          titulo: "Ahorrá más",
          texto: "Estás en <strong>" + fmtPct(dist.ahorro) + "</strong> de ahorro y tu objetivo es <strong>" +
            fmtPct(objetivoPct) + "</strong>. Te faltan <strong>" + dinero(moneda, falta) +
            "</strong>: automatizá una transferencia al ahorro apenas cobrás.",
        });
      }
      return;
    }

    if (brecha < -1) {
      // El grupo gasta más de lo que pide el objetivo: hay que recortar.
      const recorte = (-brecha / 100) * ingreso;
      const cats = cfg.categorias
        .map(function (c, i) { return { c: c, monto: reparto.montoCategoria[i] }; })
        .filter(function (x) { return (x.c.grupo || "necesidad") === grupo; })
        .sort(function (a, b) { return b.monto - a.monto; });
      const sumaGrupo = porGrupo[grupo] || cats.reduce(function (a, x) { return a + x.monto; }, 0);

      salida.push({
        tipo: "grupo",
        titulo: ETIQUETAS_GRUPO[grupo] + " · " + fmtPct(dist[grupo]) + " → " + fmtPct(objetivoPct),
        texto: "Gastás <strong>" + dinero(moneda, sumaGrupo) + "</strong> y tu objetivo es <strong>" +
          dinero(moneda, (objetivoPct / 100) * ingreso) + "</strong>. Recortá unos <strong>" +
          dinero(moneda, recorte) + "</strong>:",
      });

      cats.slice(0, 3).forEach(function (x) {
        const corte = sumaGrupo > 0 ? recorte * (x.monto / sumaGrupo) : 0;
        if (corte < 1) return;
        huboRecorte = true;
        salida.push({
          tipo: "recorte",
          titulo: x.c.nombre + " · " + fmtPct((x.monto / ingreso) * 100),
          texto: "Gastás <strong>" + dinero(moneda, x.monto) + "</strong>. Bajá unos <strong>" +
            dinero(moneda, corte) + "</strong>: " + accionParaCategoria(x.c.nombre),
        });
      });
    }
  });

  if (!huboRecorte && reparto.restante <= 0.01) {
    const faltaAhorro = objetivo.grupos.ahorro - dist.ahorro;
    if (Math.abs(faltaAhorro) <= 1) {
      salida.push({
        tipo: "ok",
        titulo: "¡Objetivo cumplido!",
        texto: "Tu reparto ya está en línea con <strong>" + objetivo.emoji + " " + esc(objetivo.nombre) +
          "</strong>. Mantenelo y sumá el excedente al ahorro 💪",
      });
    } else if (faltaAhorro < -1) {
      salida.push({
        tipo: "ok",
        titulo: "Vas mejor que el objetivo",
        texto: "Ahorrás <strong>" + fmtPct(dist.ahorro) + "</strong>, más que el objetivo <strong>" +
          objetivo.emoji + " " + esc(objetivo.nombre) + " (" + fmtPct(objetivo.grupos.ahorro) +
          ")</strong>. No hay recortes que hacer: mantené el hábito 💪",
      });
    }
  }

  return salida;
}

function renderConsejero() {
  const cont = $("#consejero");
  if (!cont) return;

  const sel = $("#objetivo-perfil");
  if (sel) {
    const objetivoActual = (estado.config && estado.config.objetivo) || "equilibrado";
    sel.innerHTML = PERFILES.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === objetivoActual ? " selected" : "") + ">" +
        esc(p.emoji + " " + p.nombre + " · " + p.grupos.necesidad + "/" + p.grupos.deseo + "/" + p.grupos.ahorro) +
        "</option>";
    }).join("");
  }

  const ingreso = Number(estado.monto) || 0;
  const lista = consejosConsejero(estado.config, ingreso);
  cont.innerHTML = lista.map(function (s) {
    return '<div class="consejo consejo-' + s.tipo + '">' +
      (s.titulo ? '<span class="consejo-titulo">' + esc(s.titulo) + "</span>" : "") +
      '<span class="consejo-texto">' + s.texto + "</span>" +
      "</div>";
  }).join("");
}

/* ============================================================
   Perfiles de reparto
   ============================================================ */

function buscarPerfil(id) {
  return PERFILES.filter(function (p) { return p.id === id; })[0] || null;
}

/* Suma de porcentajes por grupo (solo categorias porcentuales). */
function pesosNominalesGrupo(cfg) {
  const r = { necesidad: 0, deseo: 0, ahorro: 0 };
  cfg.categorias.forEach(function (c) {
    if (c.modo === "porcentaje") r[c.grupo || "necesidad"] += Number(c.porcentaje) || 0;
  });
  return r;
}

/* Distribucion real por grupo (sobre el ingreso). Si no hay ingreso,
   usa los porcentajes nominales normalizados. */
function distribucionActualGrupo(cfg, ingreso) {
  if (ingreso > 0) {
    const reparto = calcularReparto(cfg, ingreso);
    const g = calcularSubtotalesGrupo(reparto, cfg);
    return {
      necesidad: (g.necesidad / ingreso) * 100,
      deseo: (g.deseo / ingreso) * 100,
      ahorro: (g.ahorro / ingreso) * 100,
    };
  }
  const nom = pesosNominalesGrupo(cfg);
  const total = nom.necesidad + nom.deseo + nom.ahorro;
  return {
    necesidad: total > 0 ? (nom.necesidad / total) * 100 : 0,
    deseo: total > 0 ? (nom.deseo / total) * 100 : 0,
    ahorro: total > 0 ? (nom.ahorro / total) * 100 : 0,
  };
}

/* Reparte un objetivo (pesos por grupo) entre las categorias porcentuales de
   cada grupo. Las categorias fijas no se tocan. */
function fijarPesosGrupo(objetivos) {
  GRUPOS.forEach(function (grupo) {
    const cats = estado.config.categorias.filter(function (c) {
      return (c.grupo || "necesidad") === grupo && c.modo === "porcentaje";
    });
    if (!cats.length) return;
    const objetivo = Math.max(0, Number(objetivos[grupo]) || 0);
    const sumaActual = cats.reduce(function (a, c) { return a + (Number(c.porcentaje) || 0); }, 0);
    let acumulado = 0;
    cats.forEach(function (c, i) {
      let v;
      if (i === cats.length - 1) {
        v = objetivo - acumulado;
      } else {
        v = sumaActual > 0
          ? (objetivo * (Number(c.porcentaje) || 0)) / sumaActual
          : objetivo / cats.length;
      }
      v = Math.max(0, Math.round(v * 10) / 10);
      c.porcentaje = v;
      acumulado += v;
    });
  });
}

function perfilActual(cfg, ingreso) {
  const dist = distribucionActualGrupo(cfg, ingreso);
  let mejor = null;
  let mejorDist = Infinity;
  PERFILES.forEach(function (p) {
    const d =
      Math.pow(dist.necesidad - p.grupos.necesidad, 2) +
      Math.pow(dist.deseo - p.grupos.deseo, 2) +
      Math.pow(dist.ahorro - p.grupos.ahorro, 2);
    if (d < mejorDist) { mejorDist = d; mejor = p; }
  });
  return mejor;
}

function aplicarPerfil(id) {
  const p = buscarPerfil(id);
  if (!p) return;
  fijarObjetivoReal(p.grupos, Number(estado.monto) || 0);
  reiniciarPlan();
  guardarConfig(estado.config);
  renderAjustar();
  toast("Perfil " + p.nombre + " aplicado ✔");
}

function renderPerfiles() {
  const cont = $("#perfiles");
  if (!cont) return;
  cont.innerHTML = PERFILES.map(function (p) {
    return '<button type="button" class="perfil-btn" data-perfil="' + p.id + '">' +
      '<span class="perfil-emoji" aria-hidden="true">' + p.emoji + "</span>" +
      '<span class="perfil-info">' +
        '<span class="perfil-nombre">' + esc(p.nombre) + "</span>" +
        '<span class="perfil-pesos">' + p.grupos.necesidad + "/" + p.grupos.deseo + "/" + p.grupos.ahorro + "</span>" +
      "</span>" +
      '<span class="perfil-barra" aria-hidden="true">' +
        '<span class="perfil-barra-parte pb-necesidad" style="width:' + p.grupos.necesidad + '%"></span>' +
        '<span class="perfil-barra-parte pb-deseo" style="width:' + p.grupos.deseo + '%"></span>' +
        '<span class="perfil-barra-parte pb-ahorro" style="width:' + p.grupos.ahorro + '%"></span>' +
      "</span>" +
    "</button>";
  }).join("");

  const actual = $("#perfil-actual");
  if (actual) {
    const p = perfilActual(estado.config, Number(estado.monto) || 0);
    actual.innerHTML = "Tu perfil actual: <strong>" +
      esc(p ? p.emoji + " " + p.nombre : "—") + "</strong>";
  }
}

/* ============================================================
   Plan de evolucion (acercarse al ideal 50/30/20 de a poco)
   ============================================================ */

function mesesPlan() {
  const s = $("#plan-meses");
  const n = s ? Number(s.value) : 6;
  return Math.max(3, Math.min(12, isFinite(n) && n > 0 ? Math.round(n) : 6));
}

/* Deltas del último "Aplicar próximo paso" (para mostrar +/- en las listas). */
let planDeltas = null;

function limpiarDeltasPlan() {
  planDeltas = null;
}

/* Quita los badges +/- del DOM (cuando una edición manual invalida el plan). */
function quitarBadgesDeltas() {
  document.querySelectorAll(".delta").forEach(function (el) { el.remove(); });
}

/* Reinicia el plan: vuelve a tomar la distribución actual como punto de partida. */
function reiniciarPlan() {
  if (estado.config) {
    estado.config.planBase = null;
    estado.config.planPaso = 0;
  }
  limpiarDeltasPlan();
  quitarBadgesDeltas();
}

/* Suma los montos fijos (en pesos) de cada grupo. */
function fijosPorGrupo(cfg) {
  return calcularSubtotalesGrupo(calcularReparto(cfg, 0), cfg);
}

/* Punto de partida del plan (o la distribución actual si no hay plan activo). */
function planBaseActual(cfg, ingreso, meses) {
  const base = cfg.planBase;
  const paso = Math.round(Number(cfg.planPaso) || 0);
  const valido = base && typeof base === "object" &&
    GRUPOS.every(function (g) { return isFinite(Number(base[g])); }) &&
    paso >= 0 && paso <= meses;
  if (!valido) {
    return { base: distribucionActualGrupo(cfg, ingreso), paso: 0 };
  }
  return { base: base, paso: paso };
}

/* Reparte un objetivo (% REAL del ingreso por grupo) entre las categorías
   porcentuales, teniendo en cuenta los montos fijos ya reservados.
   Convierte el objetivo real a pesos "porcentuales" y normaliza a 100,
   así los % siguen siendo valores 0..100 como pide la app. */
function fijarObjetivoReal(objetivosPct, ingreso) {
  if (!(ingreso > 0)) {
    fijarPesosGrupo(objetivosPct);
    return;
  }
  const fijos = fijosPorGrupo(estado.config);
  const necesario = {};
  let totalNec = 0;
  GRUPOS.forEach(function (g) {
    necesario[g] = Math.max(0, ((Number(objetivosPct[g]) || 0) / 100) * ingreso - fijos[g]);
    totalNec += necesario[g];
  });
  if (totalNec <= 0) return;

  GRUPOS.forEach(function (g) {
    const cats = estado.config.categorias.filter(function (c) {
      return (c.grupo || "necesidad") === g && c.modo === "porcentaje";
    });
    if (!cats.length) return;
    const peso = (necesario[g] / totalNec) * 100; // % normalizado (0..100)
    const sumaActual = cats.reduce(function (a, c) { return a + (Number(c.porcentaje) || 0); }, 0);
    let acum = 0;
    cats.forEach(function (c, i) {
      let v;
      if (i === cats.length - 1) {
        v = peso - acum;
      } else {
        v = sumaActual > 0
          ? (peso * (Number(c.porcentaje) || 0)) / sumaActual
          : peso / cats.length;
      }
      v = Math.max(0, Math.round(v * 10) / 10);
      c.porcentaje = v;
      acum += v;
    });
  });
}

/* Formato de los deltas: "+5 pt" / "-3 pt" y "+$ 1.000,00" / "-$ 800,00". */
function fmtDeltaPt(v) {
  const n = Math.round(Number(v) * 10) / 10;
  if (!n) return "";
  return (n > 0 ? "+" : "-") + Math.abs(n).toLocaleString("es") + " pt";
}

function fmtDeltaDinero(moneda, v) {
  const n = Math.round(Number(v) * 100) / 100;
  if (!n) return "";
  return (n > 0 ? "+" : "-") + dinero(moneda, Math.abs(n));
}

function badgeDelta(texto, v) {
  if (!texto) return "";
  return '<span class="delta delta-' + (v > 0 ? "sube" : "baja") + '">' + texto + "</span>";
}

function barraGrupos(p) {
  const n = Math.max(0, p.necesidad);
  const d = Math.max(0, p.deseo);
  const a = Math.max(0, p.ahorro);
  const total = n + d + a || 1;
  return '<span class="plan-barra" aria-hidden="true">' +
    '<span class="pb-necesidad" style="width:' + ((n / total) * 100).toFixed(1) + '%"></span>' +
    '<span class="pb-deseo" style="width:' + ((d / total) * 100).toFixed(1) + '%"></span>' +
    '<span class="pb-ahorro" style="width:' + ((a / total) * 100).toFixed(1) + '%"></span>' +
    "</span>";
}

function renderPlan() {
  const cont = $("#plan-timeline");
  if (!cont) return;
  const meses = mesesPlan();
  const ingreso = Number(estado.monto) || 0;
  const valor = $("#plan-meses-valor");
  if (valor) valor.textContent = meses;

  const actual = distribucionActualGrupo(estado.config, ingreso);
  const info = planBaseActual(estado.config, ingreso, meses);

  let html = '<div class="plan-fila plan-fila-hoy">' +
    '<span class="plan-fila-mes">Hoy</span>' + barraGrupos(actual) +
    '<span class="plan-fila-ahorro">' + fmtPct(actual.ahorro) + "</span></div>";

  for (let m = 1; m <= meses; m++) {
    const p = {};
    GRUPOS.forEach(function (g) {
      p[g] = info.base[g] + ((IDEAL_GRUPO[g] - info.base[g]) * m) / meses;
    });
    const esFinal = m === meses;
    const esPaso = !esFinal && m === info.paso;
    html += '<div class="plan-fila' + (esFinal ? " plan-fila-ideal" : "") +
      (esPaso ? " plan-fila-paso" : "") + '">' +
      '<span class="plan-fila-mes">' + (esFinal ? "Ideal" : "Mes " + m) + "</span>" +
      barraGrupos(p) +
      '<span class="plan-fila-ahorro">' + fmtPct(p.ahorro) + "</span></div>";
  }
  cont.innerHTML = html;

  // Aviso: grupos que no pueden bajar del ideal por tener montos fijos altos.
  const fijos = fijosPorGrupo(estado.config);
  const bloqueados = GRUPOS.filter(function (g) {
    return ingreso > 0 && (fijos[g] / ingreso) * 100 > IDEAL_GRUPO[g] + 0.5;
  });
  const aviso = $("#plan-aviso");
  if (aviso) {
    if (bloqueados.length) {
      aviso.hidden = false;
      aviso.innerHTML = "⚠️ " + bloqueados.map(function (g) {
        return ETIQUETAS_GRUPO[g] + " ya usa " + fmtPct((fijos[g] / ingreso) * 100) +
          " solo en montos fijos";
      }).join(" · ") + ": no puede bajar del ideal con porcentajes.";
    } else {
      aviso.hidden = true;
    }
  }

  const btn = $("#btn-paso");
  if (btn) {
    const listo = info.paso >= meses ||
      GRUPOS.every(function (g) { return Math.abs(actual[g] - IDEAL_GRUPO[g]) < 0.5; });
    btn.disabled = listo;
    if (listo) {
      btn.textContent = bloqueados.length
        ? "Plan completo: revisá los montos fijos 🔒"
        : "¡Ya estás en el ideal! 🎉";
    } else {
      btn.textContent = "Aplicar próximo paso";
    }
  }
}

function aplicarProximoPaso() {
  const meses = mesesPlan();
  const ingreso = Number(estado.monto) || 0;
  const cfg = estado.config;
  const actual = distribucionActualGrupo(cfg, ingreso);
  const info = planBaseActual(cfg, ingreso, meses);
  const listo = info.paso >= meses ||
    GRUPOS.every(function (g) { return Math.abs(actual[g] - IDEAL_GRUPO[g]) < 0.5; });
  if (listo) { toast("¡Ya estás en el ideal! 🎉"); return; }

  const pasoNuevo = Math.min(meses, info.paso + 1);
  const objetivo = {};
  GRUPOS.forEach(function (g) {
    objetivo[g] = info.base[g] + ((IDEAL_GRUPO[g] - info.base[g]) * pasoNuevo) / meses;
  });

  // Estado "antes" para poder mostrar los deltas (+/-) en las listas.
  const antesPct = cfg.categorias.map(function (c) { return Number(c.porcentaje) || 0; });
  const repartoAntes = calcularReparto(cfg, ingreso);
  const antesMonto = cfg.categorias.map(function (c, i) { return repartoAntes.montoCategoria[i]; });

  fijarObjetivoReal(objetivo, ingreso);

  const repartoDespues = calcularReparto(cfg, ingreso);
  planDeltas = {};
  cfg.categorias.forEach(function (c, i) {
    const dpct = (Number(c.porcentaje) || 0) - antesPct[i];
    const dmonto = repartoDespues.montoCategoria[i] - antesMonto[i];
    const dreal = ingreso > 0 ? (dmonto / ingreso) * 100 : 0;
    if (Math.abs(dpct) > 0.05 || Math.abs(dmonto) > 0.5) {
      planDeltas[i] = { dpct: dpct, dreal: dreal, dmonto: dmonto };
    }
  });

  cfg.planBase = {
    necesidad: Number(info.base.necesidad) || 0,
    deseo: Number(info.base.deseo) || 0,
    ahorro: Number(info.base.ahorro) || 0,
  };
  cfg.planPaso = pasoNuevo;
  guardarConfig(cfg);
  renderAjustar();
  toast("Próximo paso aplicado ✔");
}

/* Repinta perfiles + plan + consejero (cambió el ingreso o los porcentajes). */
function actualizarPanelLateral() {
  const cont = $("#perfiles");
  if (!cont) return;
  renderPerfiles();
  renderPlan();
  renderConsejero();
}

/* ============================================================
   Historial financiero (calendario + torta + evolucion)
   ============================================================ */

let histAnio = new Date().getFullYear();
let histMesSel = null;

function mesActualClave() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function nombreMes(indice, largo) {
  const d = new Date(2020, indice, 1);
  const texto = d.toLocaleString("es-AR", { month: largo ? "long" : "short" });
  return texto.replace(/\.$/, "");
}

/* Guarda (o actualiza) el mes en curso con el reparto actual. */
function guardarMesActual() {
  const cfg = estado.config;
  const ingreso = Number(estado.monto) || 0;
  const reparto = calcularReparto(cfg, ingreso);
  const g = calcularSubtotalesGrupo(reparto, cfg);
  const pctGrupos = {};
  GRUPOS.forEach(function (grupo) { pctGrupos[grupo] = ingreso > 0 ? (g[grupo] / ingreso) * 100 : 0; });
  const p = perfilActual(cfg, ingreso);

  const registro = {
    mes: mesActualClave(),
    guardado: new Date().toISOString(),
    moneda: cfg.moneda,
    monto: ingreso,
    grupos: { necesidad: g.necesidad, deseo: g.deseo, ahorro: g.ahorro },
    pctGrupos: pctGrupos,
    categorias: cfg.categorias.map(function (c, i) {
      return { nombre: c.nombre, grupo: c.grupo || "necesidad", monto: reparto.montoCategoria[i] };
    }),
    perfil: p ? p.id : null,
  };
  guardarMesHistorial(registro);
  histAnio = new Date().getFullYear();
  histMesSel = registro.mes;
  toast("Mes guardado en el historial 📅");
}

/* Torta SVG a partir de un registro del historial. */
function tortaSVG(registro) {
  const cx = 100, cy = 100, r = 74, ancho = 30;
  const totalBase = Number(registro.monto) > 0
    ? Number(registro.monto)
    : registro.categorias.reduce(function (a, c) { return a + (Number(c.monto) || 0); }, 0);
  const C = 2 * Math.PI * r;
  let acumGrados = 0;
  let acumMonto = 0;
  let circ = "";
  registro.categorias.forEach(function (c, i) {
    const monto = Number(c.monto) || 0;
    acumMonto += monto;
    const frac = totalBase > 0 ? monto / totalBase : 0;
    if (frac <= 0.0005) return;
    const largo = frac * C;
    circ += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' +
      colorDeCategoria(i) + '" stroke-width="' + ancho + '" stroke-dasharray="' +
      largo.toFixed(3) + " " + (C - largo).toFixed(3) + '" transform="rotate(' +
      (acumGrados - 90).toFixed(2) + " " + cx + " " + cy + ')"></circle>';
    acumGrados += frac * 360;
  });
  const pct = totalBase > 0 ? (acumMonto / totalBase) * 100 : 0;
  return '<svg class="hist-torta-svg" viewBox="0 0 200 200" role="img" aria-label="Distribución del mes">' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#e2e8f0" stroke-width="' + ancho + '"></circle>' +
    circ +
    '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" class="grafico-centro">' + fmtPct(pct) + "</text>" +
    '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" class="grafico-sub">del ingreso</text>' +
    "</svg>";
}

function renderDetalleMes(registro) {
  const cont = $("#hist-detalle");
  if (!cont) return;
  if (!registro) {
    cont.innerHTML = '<div class="tarjeta"><p class="nota" style="margin:0">Todavía no guardaste ningún mes. ' +
      "En la pantalla de resultado toca <strong>📅 Guardar este mes</strong> para empezar tu historial.</p></div>";
    return;
  }
  const perfil = buscarPerfil(registro.perfil);
  const partes = String(registro.mes).split("-");
  const titulo = nombreMes(Number(partes[1]) - 1, true) + " " + partes[0];

  const gruposHTML = GRUPOS.map(function (g) {
    return '<div class="hist-grupo">' +
      '<span class="chip chip-' + g + '" aria-hidden="true"></span>' +
      '<span class="hist-grupo-nombre">' + ETIQUETAS_GRUPO[g] + "</span>" +
      '<span class="hist-grupo-dato">' + fmtPct(registro.pctGrupos ? registro.pctGrupos[g] : 0) +
        " · " + dinero(registro.moneda, registro.grupos ? registro.grupos[g] : 0) + "</span>" +
      "</div>";
  }).join("");

  const catsHTML = registro.categorias.map(function (c, i) {
    return '<div class="hist-cat">' +
      '<span class="fila-dot" style="background:' + colorDeCategoria(i) + '" aria-hidden="true"></span>' +
      '<span class="hist-cat-nombre">' + esc(c.nombre) + "</span>" +
      '<span class="hist-cat-monto">' + dinero(registro.moneda, c.monto) + "</span>" +
      "</div>";
  }).join("");

  cont.innerHTML =
    '<div class="tarjeta">' +
      '<div class="hist-mes-cabecera">' +
        '<h3 class="hist-mes-titulo">' + esc(titulo) + "</h3>" +
        (perfil ? '<span class="hist-perfil">' + perfil.emoji + " " + esc(perfil.nombre) + "</span>" : "") +
      "</div>" +
      '<div class="hist-mes-cuerpo">' +
        '<div class="hist-torta">' + tortaSVG(registro) + "</div>" +
        '<div class="hist-grupos">' + gruposHTML + "</div>" +
      "</div>" +
      '<div class="hist-cats">' + catsHTML + "</div>" +
    "</div>";
}

function renderEvolucion(lista) {
  const cont = $("#hist-evolucion");
  if (!cont) return;
  if (!lista.length) {
    cont.innerHTML = '<p class="nota" style="margin:0">Sin datos todavía. Guardá algunos meses para ver tu evolución.</p>';
    return;
  }
  const datos = lista.slice().sort(function (a, b) { return a.mes < b.mes ? -1 : 1; });
  const maxY = 50;
  const W = 320, H = 170, ml = 26, mr = 10, mt = 14, mb = 26;
  const anchoUtil = W - ml - mr;
  const altoUtil = H - mt - mb;
  const paso = anchoUtil / datos.length;
  const anchoBarra = Math.min(26, paso * 0.62);

  let barras = "";
  datos.forEach(function (r, i) {
    const pct = Math.max(0, Math.min(maxY, (r.pctGrupos && r.pctGrupos.ahorro) || 0));
    const h = (pct / maxY) * altoUtil;
    const x = ml + i * paso + (paso - anchoBarra) / 2;
    const y = mt + altoUtil - h;
    barras += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + anchoBarra.toFixed(1) +
      '" height="' + h.toFixed(1) + '" rx="4" fill="#10b981"></rect>';
    barras += '<text x="' + (x + anchoBarra / 2).toFixed(1) + '" y="' + (H - mb + 14) +
      '" text-anchor="middle" class="evo-mes">' + nombreMes(Number(r.mes.slice(5, 7)) - 1, false) + "</text>";
  });

  const yIdeal = mt + altoUtil - (IDEAL_GRUPO.ahorro / maxY) * altoUtil;
  const linea = '<line x1="' + ml + '" y1="' + yIdeal.toFixed(1) + '" x2="' + (W - mr) + '" y2="' + yIdeal.toFixed(1) +
    '" stroke="#94a3b8" stroke-dasharray="4 3"></line>' +
    '<text x="' + (W - mr) + '" y="' + (yIdeal - 4).toFixed(1) + '" text-anchor="end" class="evo-ideal">ideal ' +
    IDEAL_GRUPO.ahorro + "%</text>";

  cont.innerHTML = '<svg class="hist-evo-svg" viewBox="0 0 ' + W + " " + H +
    '" role="img" aria-label="Evolución del ahorro mes a mes">' + linea + barras + "</svg>";
}

function renderHistorial() {
  const lista = cargarHistorial();
  const porMes = {};
  lista.forEach(function (r) { porMes[r.mes] = r; });

  const anioEl = $("#hist-anio");
  if (anioEl) anioEl.textContent = String(histAnio);

  // Elegir el último mes con datos dentro del año visible.
  if (!histMesSel || histMesSel.slice(0, 4) !== String(histAnio)) {
    let candidato = null;
    lista.forEach(function (r) { if (r.mes.slice(0, 4) === String(histAnio)) candidato = r.mes; });
    histMesSel = candidato;
  }

  const cal = $("#hist-calendario");
  if (cal) {
    cal.innerHTML = "";
    for (let m = 0; m < 12; m++) {
      const clave = histAnio + "-" + String(m + 1).padStart(2, "0");
      const r = porMes[clave];
      const celda = document.createElement("button");
      celda.type = "button";
      celda.className = "hist-celda" + (r ? " con-datos" : "") + (clave === histMesSel ? " seleccionado" : "");
      celda.dataset.mes = clave;
      celda.innerHTML = '<span class="hist-celda-mes">' + nombreMes(m, false) + "</span>" +
        '<span class="hist-celda-monto">' + (r ? dineroCorto(r.monto) : "—") + "</span>";
      if (!r) celda.setAttribute("disabled", "disabled");
      cal.appendChild(celda);
    }
  }

  renderDetalleMes(histMesSel ? porMes[histMesSel] : null);
  renderEvolucion(lista);
}

/* ---------- Cotizacion en vivo (dolarapi.com) ---------- */

let secuenciaCotizacion = 0;

const API_DOLAR = "https://dolarapi.com/v1/dolares/";

function textoEstadoCotizacion() {
  const c = estado.cotizacion;
  if (c && c.estado === "cargando") return "Consultando…";
  if (!c || !(Number(c.valor) > 0)) {
    return "Sin cotización. Podés cargarla a mano si estás sin conexión.";
  }
  const cuando = fechaCorta(c.fecha);
  if (c.estado === "manual") return "Valor cargado a mano" + (cuando ? " el " + cuando : "") + ".";
  if (c.estado === "cache") {
    return "Sin conexión · última cotización " + (cuando ? "del " + cuando : "") +
      (c.fuente === "manual" ? " (a mano)" : "") + ".";
  }
  return "Actualizado" + (cuando ? " el " + cuando : "") + " · dolarapi.com";
}

function renderCotizacion() {
  const sel = $("#dolar-tipo");
  if (sel) {
    const tipo = (estado.config && estado.config.dolarTipo) || "bolsa";
    sel.innerHTML = DOLARES.map(function (d) {
      return '<option value="' + d.id + '"' + (d.id === tipo ? " selected" : "") + ">" + esc(d.nombre) + "</option>";
    }).join("");
  }

  const valor = $("#cotizacion-valor");
  if (valor) valor.textContent = tasaCotizacion() > 0 ? dinero("ARS", tasaCotizacion()) : "—";

  const estadoTexto = $("#cotizacion-estado");
  if (estadoTexto) estadoTexto.textContent = textoEstadoCotizacion();

  const nota = $("#nota-cotizacion");
  if (nota) {
    if (hayAhorroUSD(estado.config)) {
      const c = estado.cotizacion;
      nota.hidden = false;
      nota.innerHTML =
        "Ahorro en dólares a " + esc(nombreDolarActual()) + ": <strong>" +
        (tasaCotizacion() > 0 ? dinero("ARS", tasaCotizacion()) : "sin cotización") + "</strong>" +
        (fechaCorta(c && c.fecha) ? " · " + esc(fechaCorta(c.fecha)) : "");
    } else {
      nota.hidden = true;
    }
  }
}

/* Consulta la cotizacion. Si falla (sin conexion), usa el ultimo valor guardado. */
async function actualizarCotizacion(esExplicito) {
  const tipo = (estado.config && estado.config.dolarTipo) || "bolsa";
  if (esExplicito) estado.cotizacionManual = false;
  const miSecuencia = ++secuenciaCotizacion;

  estado.cotizacion = Object.assign({ tipo: tipo }, estado.cotizacion, { tipo: tipo, estado: "cargando" });
  renderCotizacion();

  let resultado = null;
  try {
    const respuesta = await fetch(API_DOLAR + encodeURIComponent(tipo), { cache: "no-store" });
    if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);
    const datos = await respuesta.json();
    const venta = Number(datos && datos.venta);
    if (!isFinite(venta) || venta <= 0) throw new Error("cotización inválida");
    resultado = {
      tipo: tipo,
      valor: venta,
      fecha: datos.fechaActualizacion || new Date().toISOString(),
      fuente: "dolarapi.com",
      estado: "ok",
    };
  } catch (_) {
    const guardada = cotizacionGuardada(tipo);
    if (guardada) {
      resultado = Object.assign({}, guardada, { estado: "cache" });
    } else if (estado.cotizacion && Number(estado.cotizacion.valor) > 0) {
      resultado = Object.assign({}, estado.cotizacion, { estado: "cache" });
    } else {
      resultado = { tipo: tipo, valor: 0, fecha: null, fuente: null, estado: "error" };
    }
  }

  if (miSecuencia !== secuenciaCotizacion) return; // hubo una acción más nueva
  if (estado.cotizacionManual && !esExplicito) return; // el usuario cargó un valor a mano
  estado.cotizacion = resultado;
  if (resultado.estado === "ok") guardarCotizacion(resultado);
  renderCotizacion();
  refrescarPantallaActual();
}

function usarCotizacionManual() {
  const n = parsearEntradaMonto($("#cotizacion-input").value);
  if (n === null || n <= 0) {
    toast("Escribe una cotización mayor a cero.");
    return;
  }
  secuenciaCotizacion++; // invalida cualquier consulta en curso
  estado.cotizacionManual = true;
  estado.cotizacion = {
    tipo: (estado.config && estado.config.dolarTipo) || "bolsa",
    valor: n,
    fecha: new Date().toISOString(),
    fuente: "manual",
    estado: "manual",
  };
  guardarCotizacion(estado.cotizacion);
  renderCotizacion();
  refrescarPantallaActual();
  toast("Cotización cargada ✔");
}

/* Arranca la cotización: muestra la última guardada y consulta en segundo plano. */
function iniciarCotizacion() {
  const tipo = (estado.config && estado.config.dolarTipo) || "bolsa";
  const guardada = cotizacionGuardada(tipo);
  estado.cotizacion = guardada
    ? { tipo: tipo, valor: guardada.valor, fecha: guardada.fecha, fuente: guardada.fuente, estado: "cache" }
    : { tipo: tipo, valor: 0, fecha: null, fuente: null, estado: "error" };
  renderCotizacion();
  actualizarCotizacion(false);
}

/* Vuelve a pintar lo visible tras cambiar la cotización. */
function refrescarPantallaActual() {
  const nombre = pantallaRepartoActual();
  if (nombre === "resultado") {
    renderResultado();
  } else if (nombre === "ajustar") {
    actualizarTodosLosDerivados();
    actualizarSuma();
    renderCotizacion();
  }
  actualizarPanelLateral();
}

/* Cambia una categoria de ahorro entre pesos y dolares conservando el valor. */
function cambiarMonedaMonto(c) {
  const tasa = tasaCotizacion();
  if (c.monedaMonto === "USD") {
    if (tasa > 0) c.monto = Math.round((Number(c.monto) || 0) * tasa * 100) / 100;
    c.monedaMonto = "ARS";
  } else {
    if (tasa > 0) c.monto = Math.round(((Number(c.monto) || 0) / tasa) * 100) / 100;
    c.monedaMonto = "USD";
    if (tasa <= 0) toast("Cargá la cotización del dólar para ver la conversión.");
  }
}

/* ---------- Imagen PNG del reparto (canvas, sin dependencias) ---------- */

const TIPOGRAFIA_PNG = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function fijarFuentePNG(ctx, peso, tamano) {
  ctx.font = (peso ? peso + " " : "") + tamano + "px " + TIPOGRAFIA_PNG;
}

function dibujarTextoPNG(ctx, texto, x, y, opc) {
  opc = opc || {};
  fijarFuentePNG(ctx, opc.peso, opc.tamano || 16);
  ctx.fillStyle = opc.color || "#0f172a";
  ctx.textAlign = opc.align || "left";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, x, y);
}

function recortarTextoPNG(ctx, texto, maxAncho) {
  if (ctx.measureText(texto).width <= maxAncho) return texto;
  let recortado = texto;
  while (recortado.length > 1 && ctx.measureText(recortado + "…").width > maxAncho) {
    recortado = recortado.slice(0, -1);
  }
  return recortado + "…";
}

function crearCanvasReparto() {
  const monto = estado.monto || 0;
  const cfg = estado.config;
  const moneda = cfg.moneda;
  const reparto = calcularReparto(cfg, monto);
  const exceso = reparto.restante < -0.01;
  const incompleto = reparto.restante > 0.01 && monto > 0;
  const porGrupo = calcularSubtotalesGrupo(reparto, cfg);

  const ESCALA = 2;
  const W = 540;
  const M = 40;
  const contenido = W - M * 2;
  const filaAlto = 40;
  const tituloGrupoAlto = 30;

  const filasPorGrupo = GRUPOS.map(function () { return []; });
  cfg.categorias.forEach(function (c, i) {
    const idx = GRUPOS.indexOf(c.grupo || "necesidad");
    filasPorGrupo[idx].push(i);
  });

  const conUSD = hayAhorroUSD(cfg);

  // Altura del lienzo (unidades logicas, salida a ESCALA).
  let H = 96 + 86; // cabecera + resumen
  if (exceso || incompleto) H += 38;
  H += 190 + 10; // torta + separacion
  GRUPOS.forEach(function (g, idx) {
    if (filasPorGrupo[idx].length) H += tituloGrupoAlto + filasPorGrupo[idx].length * filaAlto;
  });
  if (incompleto) H += filaAlto;
  if (conUSD) H += 34; // nota de la cotizacion del dolar
  H += 30 + 24 + 26; // separador + texto final + margen inferior

  const canvas = document.createElement("canvas");
  canvas.width = W * ESCALA;
  canvas.height = H * ESCALA;
  const ctx = canvas.getContext("2d");
  ctx.scale(ESCALA, ESCALA);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  let y = 0;

  // --- Cabecera ---
  y += 46;
  const cxMoneda = W / 2 - 92;
  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(cxMoneda, y - 4, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  fijarFuentePNG(ctx, 800, 20);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", cxMoneda, y - 3);
  dibujarTextoPNG(ctx, "GastaMejor", W / 2 + 26, y - 4, { tamano: 30, peso: 800, align: "center" });
  dibujarTextoPNG(ctx, "Tu dinero, repartido bien", W / 2, y + 22, { tamano: 14, color: "#64748b", align: "center" });
  y += 50;

  // --- Resumen ---
  y += 8;
  function resumen(etiqueta, valor, color) {
    dibujarTextoPNG(ctx, etiqueta, M, y, { tamano: 17, color: "#64748b" });
    dibujarTextoPNG(ctx, valor, W - M, y, { tamano: 20, peso: 800, align: "right", color: color || "#0f172a" });
    y += 34;
  }
  resumen("Ingreso", monto > 0 ? dinero(moneda, monto) : "—");
  resumen("Total repartido", monto > 0 ? dinero(moneda, reparto.asignado) : "—", exceso ? "#dc2626" : undefined);
  y += 2;
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, y);
  ctx.lineTo(W - M, y);
  ctx.stroke();
  y += 16;

  // --- Avisos ---
  if (exceso) {
    dibujarTextoPNG(ctx, "Los gastos fijos superan tu ingreso por " + dinero(moneda, -reparto.restante), W / 2, y, { tamano: 15, peso: 700, color: "#dc2626", align: "center" });
    y += 38;
  } else if (incompleto) {
    dibujarTextoPNG(ctx, "Te quedan " + dinero(moneda, reparto.restante) + " sin repartir · Sin designar", W / 2, y, { tamano: 15, peso: 700, color: "#92400e", align: "center" });
    y += 38;
  }

  // --- Torta ---
  const tCX = W / 2;
  const tY = y + 90;
  const tR = 72;
  const tAncho = 26;

  ctx.strokeStyle = exceso ? "#fee2e2" : "#e2e8f0";
  ctx.lineWidth = tAncho;
  ctx.beginPath();
  ctx.arc(tCX, tY, tR, 0, Math.PI * 2);
  ctx.stroke();

  const totalBase = exceso ? reparto.asignado : monto;
  const segmentos = [];
  cfg.categorias.forEach(function (c, i) {
    const valor = reparto.montoCategoria[i];
    const frac = totalBase > 0 ? valor / totalBase : 0;
    if (frac > 0.0005) segmentos.push({ frac: frac, color: colorDeCategoria(i) });
  });
  if (incompleto && monto > 0) {
    segmentos.push({ frac: reparto.restante / monto, color: GRIS_SIN_DESIGNAR });
  }
  let desde = -Math.PI / 2;
  segmentos.forEach(function (seg) {
    const hasta = desde + seg.frac * Math.PI * 2;
    ctx.strokeStyle = seg.color;
    ctx.lineWidth = tAncho;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.arc(tCX, tY, tR, desde, hasta);
    ctx.stroke();
    desde = hasta;
  });

  dibujarTextoPNG(ctx, fmtPct(reparto.pctTotal), tCX, tY - 10, {
    tamano: 30, peso: 800, align: "center",
    color: exceso ? "#dc2626" : incompleto ? "#92400e" : "#0f172a",
  });
  dibujarTextoPNG(ctx, "del ingreso", tCX, tY + 16, { tamano: 13, color: "#64748b", align: "center" });

  y += 190;

  // --- Desglose por grupos ---
  y += 10;
  GRUPOS.forEach(function (g, idx) {
    const indices = filasPorGrupo[idx];
    if (!indices.length) return;
    const colorGrupo = g === "necesidad" ? "#0284c7" : g === "deseo" ? "#d97706" : "#059669";
    const suma = porGrupo[g];
    const pctG = monto > 0 ? (suma / monto) * 100 : 0;
    dibujarTextoPNG(ctx, ETIQUETAS_GRUPO[g], M, y, { tamano: 13, peso: 800, color: colorGrupo });
    dibujarTextoPNG(ctx, fmtPct(pctG) + " · " + dinero(moneda, suma), W - M, y, { tamano: 14, peso: 800, color: colorGrupo, align: "right" });
    y += tituloGrupoAlto;

    indices.forEach(function (i) {
      const c = cfg.categorias[i];
      const valor = reparto.montoCategoria[i];
      const pct = monto > 0 ? (valor / monto) * 100 : 0;
      ctx.fillStyle = colorDeCategoria(i);
      ctx.beginPath();
      ctx.arc(M + 7, y, 7, 0, Math.PI * 2);
      ctx.fill();
      fijarFuentePNG(ctx, 600, 16);
      const nombre = recortarTextoPNG(ctx, c.nombre, contenido - 200);
      dibujarTextoPNG(ctx, nombre, M + 22, y, { tamano: 16, peso: 600 });
      const etiqueta = categoriaEnUSD(cfg, c)
        ? "US$ " + formatearNumeroMonto(Number(c.monto) || 0, 0) + " · " + dinero(moneda, valor)
        : dinero(moneda, valor);
      dibujarTextoPNG(ctx, fmtPct(pct) + " · " + etiqueta, W - M, y, { tamano: 15, peso: 700, color: "#334155", align: "right" });
      y += filaAlto;
    });
  });

  if (incompleto) {
    const pct = (reparto.restante / monto) * 100;
    ctx.fillStyle = GRIS_SIN_DESIGNAR;
    ctx.beginPath();
    ctx.arc(M + 7, y, 7, 0, Math.PI * 2);
    ctx.fill();
    dibujarTextoPNG(ctx, "Sin designar", M + 22, y, { tamano: 16, peso: 600, color: "#64748b" });
    dibujarTextoPNG(ctx, fmtPct(pct) + " · " + dinero(moneda, reparto.restante), W - M, y, { tamano: 15, peso: 700, color: "#64748b", align: "right" });
    y += filaAlto;
  }

  if (conUSD) {
    y += 14;
    dibujarTextoPNG(ctx, "Dólar " + nombreDolarActual() + ": " +
      (tasaCotizacion() > 0 ? dinero("ARS", tasaCotizacion()) : "sin cotización"),
      M, y, { tamano: 13, color: "#64748b" });
    y += 20;
  }

  // --- Pie ---
  y += 30;
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M, y);
  ctx.lineTo(W - M, y);
  ctx.stroke();
  y += 24;
  dibujarTextoPNG(ctx, "Hecho con GastaMejor", W / 2, y, { tamano: 13, color: "#94a3b8", align: "center" });

  return canvas;
}

function descargarImagenReparto() {
  const canvas = crearCanvasReparto();
  canvas.toBlob(function (blob) {
    if (!blob) {
      toast("No se pudo generar la imagen.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "gastamejor-reparto.png";
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Imagen descargada ⬇");
  }, "image/png");
}

/* ---------- Pantalla 3: ajustar ---------- */

function textoDerivadoCategoria(c, idx, moneda, ingreso, reparto) {
  if (c.modo === "porcentaje") {
    const monto = reparto.montoCategoria[idx];
    const pctReal = ingreso > 0 ? (monto / ingreso) * 100 : 0;
    return "= " + dinero(moneda, monto) + " · " + fmtPct(pctReal) + " del ingreso";
  }
  if (categoriaEnUSD(estado.config, c)) {
    const tasa = tasaCotizacion();
    const ars = (Number(c.monto) || 0) * tasa;
    const pct = ingreso > 0 ? (ars / ingreso) * 100 : 0;
    return "= US$ " + formatearNumeroMonto(Number(c.monto) || 0, 2) + " ≈ " + dinero(moneda, ars) +
      " · " + fmtPct(pct) + " del ingreso" +
      (tasa > 0 ? " (" + nombreDolarActual() + " " + dinero("ARS", tasa) + ")" : " · sin cotización");
  }
  const pct = ingreso > 0 ? ((Number(c.monto) || 0) / ingreso) * 100 : 0;
  return "≈ " + fmtPct(pct) + " del ingreso";
}

function renderAjustar() {
  const lista = $("#ajustar-lista");
  lista.innerHTML = "";
  const moneda = estado.config.moneda;
  const ingreso = Number(estado.monto) || 0;
  const reparto = calcularReparto(estado.config, ingreso);

  // Se agrupan las categorias por grupo (necesidades / deseos / ahorro).
  GRUPOS.forEach(function (grupo) {
    const indices = [];
    estado.config.categorias.forEach(function (c, i) {
      if ((c.grupo || "necesidad") === grupo) indices.push(i);
    });
    if (!indices.length) return;

    const bloque = document.createElement("section");
    bloque.className = "ajuste-bloque";

    const titulo = document.createElement("h3");
    titulo.className = "ajuste-bloque-titulo";
    titulo.innerHTML =
      '<span class="chip chip-' + grupo + '" aria-hidden="true"></span>' + ETIQUETAS_GRUPO[grupo];
    bloque.appendChild(titulo);

    indices.forEach(function (i) {
      bloque.appendChild(crearFilaAjuste(estado.config.categorias[i], i, moneda, ingreso, reparto));
    });
    lista.appendChild(bloque);
  });

  actualizarSuma();
  actualizarPanelLateral();
  renderCotizacion();
}

/* Construye la fila editable de una categoría. */
function crearFilaAjuste(c, i, moneda, ingreso, reparto) {
  const esPorcentaje = c.modo === "porcentaje";
  const delta = planDeltas ? planDeltas[i] : null;
  const deltaPctHTML = delta && esPorcentaje ? badgeDelta(fmtDeltaPt(delta.dpct), delta.dpct) : "";
  const deltaMontoHTML = delta ? badgeDelta(fmtDeltaDinero(moneda, delta.dmonto), delta.dmonto) : "";
  const valorCampo = esPorcentaje
    ? Number(c.porcentaje)
    : (Number(c.monto) > 0 ? formatearNumeroMonto(Number(c.monto), 2) : "");
  const unidad = !esPorcentaje && puedeCargarUSD(estado.config, c)
    ? '<button type="button" class="moneda-monto' + (c.monedaMonto === "USD" ? " usd" : "") +
      '" data-moneda-idx="' + i + '" aria-label="Moneda del monto" title="Cambiar entre pesos y dólares">' +
      (c.monedaMonto === "USD" ? "US$" : "AR$") + "</button>"
    : '<span class="pct-unidad">' + (esPorcentaje ? "%" : "$") + "</span>";

  const fila = document.createElement("div");
  fila.className = "fila-ajuste";
  fila.dataset.idx = String(i);
  fila.innerHTML =
    '<div class="ajuste-fila-nombre">' +
      '<input class="ajuste-nombre" data-ajuste="nombre" data-idx="' + i +
      '" value="' + esc(c.nombre) + '" placeholder="Nombre de la categoría" aria-label="Nombre de la categoría">' +
      '<button class="btn-borrar" data-borrar="' + i + '" aria-label="Eliminar categoría" title="Eliminar">✕</button>' +
    "</div>" +

    '<div class="ajuste-fila-controles">' +
      '<div class="modo-picker" role="group" aria-label="Tipo de asignación">' +
        '<button type="button" class="modo-btn' + (esPorcentaje ? " activo" : "") +
          '" data-modo="porcentaje" data-idx="' + i + '" aria-pressed="' + esPorcentaje + '">%</button>' +
        '<button type="button" class="modo-btn' + (esPorcentaje ? "" : " activo") +
          '" data-modo="fijo" data-idx="' + i + '" aria-pressed="' + !esPorcentaje + '">$</button>' +
      "</div>" +
      '<div class="campo-pct">' +
        '<input class="ajuste-pct" data-ajuste="' + (esPorcentaje ? "porcentaje" : "monto") +
        '" data-idx="' + i + '" type="' + (esPorcentaje ? "number" : "text") + '" inputmode="decimal"' +
        (esPorcentaje ? ' min="0" step="0.5"' : ' placeholder="0,00"') +
        ' value="' + valorCampo + '" aria-label="Valor">' +
        unidad +
        deltaPctHTML +
      "</div>" +
      '<select class="ajuste-grupo" data-ajuste="grupo" data-idx="' + i + '" aria-label="Grupo">' +
        GRUPOS.map(function (g) {
          return '<option value="' + g + '"' +
            ((c.grupo || "necesidad") === g ? " selected" : "") + ">" +
            ETIQUETAS_GRUPO[g] + "</option>";
        }).join("") +
      "</select>" +
    "</div>" +

    '<div class="derivado" data-derivado="' + i + '">' +
      textoDerivadoCategoria(c, i, moneda, ingreso, reparto) +
      deltaMontoHTML +
    "</div>";

  return fila;
}

/* Actualiza solo la linea derivada de una fila (sin perder el foco). */
function actualizarFilaDerivada(fila, c) {
  const moneda = estado.config.moneda;
  const ingreso = Number(estado.monto) || 0;
  const reparto = calcularReparto(estado.config, ingreso);
  const idx = estado.config.categorias.indexOf(c);
  const derivado = fila.querySelector("[data-derivado]");
  const unidad = fila.querySelector(".pct-unidad");
  if (unidad) unidad.textContent = c.modo === "porcentaje" ? "%" : "$";
  if (derivado) derivado.textContent = textoDerivadoCategoria(c, idx, moneda, ingreso, reparto);
}

/* Actualiza las lineas derivadas de TODAS las filas (sin perder el foco).
   Los montos se estiran: cambiar una categoria altera el reparto de las demas. */
function actualizarTodosLosDerivados() {
  const filas = $("#ajustar-lista").querySelectorAll(".fila-ajuste");
  filas.forEach(function (fila) {
    const categoria = estado.config.categorias[Number(fila.dataset.idx)];
    if (categoria) actualizarFilaDerivada(fila, categoria);
  });
}

function actualizarSuma() {
  const ingreso = Number(estado.monto) || 0;
  const moneda = estado.config.moneda;
  const reparto = calcularReparto(estado.config, ingreso);

  const el = $("#suma-valor");
  el.textContent = fmtPct(reparto.pctTotal);
  el.classList.toggle("rojo", reparto.restante < -0.01);

  const detalle = $("#suma-detalle");
  if (ingreso > 0 && reparto.sumaFijos > 0) {
    detalle.textContent =
      "Reservados en montos fijos: " + dinero(moneda, reparto.sumaFijos) +
      " · Disponible para porcentajes: " + dinero(moneda, Math.max(0, reparto.disponible));
  } else {
    detalle.textContent = "";
  }

  const rest = $("#suma-restante");
  if (ingreso <= 0) {
    rest.textContent = "Escribe tu ingreso para calcular el reparto.";
  } else if (reparto.restante < -0.01) {
    rest.textContent = "Los gastos fijos superan tu ingreso por " + dinero(moneda, -reparto.restante) + ".";
  } else if (reparto.restante > 0.01) {
    rest.textContent = "Te quedan sin repartir " + dinero(moneda, reparto.restante) + " (Sin designar).";
  } else {
    rest.textContent = "Reparto completo: usas todo tu ingreso. 🎉";
  }
}

/* ---------- Catalogo de categorias ---------- */

function renderCatalogo() {
  const contenedor = $("#catalogo-lista");
  contenedor.innerHTML = "";
  GRUPOS.forEach(function (grupo) {
    const items = CATALOGO.filter(function (item) { return item.grupo === grupo; });
    if (!items.length) return;

    const bloque = document.createElement("section");
    bloque.className = "catalogo-grupo";

    const titulo = document.createElement("h4");
    titulo.className = "catalogo-titulo";
    titulo.innerHTML =
      '<span class="chip chip-' + grupo + '" aria-hidden="true"></span>' + ETIQUETAS_GRUPO[grupo];
    bloque.appendChild(titulo);

    const lista = document.createElement("div");
    lista.className = "catalogo-lista";
    items.forEach(function (item) {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "chip-catalogo";
      boton.dataset.nombre = item.nombre;
      boton.innerHTML = esc(item.nombre) +
        ' <small>' + (item.modo === "fijo" ? "$" : "%") + "</small>";
      lista.appendChild(boton);
    });
    bloque.appendChild(lista);
    contenedor.appendChild(bloque);
  });
}

function abrirCatalogo() {
  renderCatalogo();
  $("#modal-catalogo").hidden = false;
  document.body.style.overflow = "hidden";
}

function cerrarCatalogo() {
  $("#modal-catalogo").hidden = true;
  document.body.style.overflow = "";
}

/* ---------- Selector de moneda (pantalla de ingreso) ---------- */

function construirSelectMoneda() {
  const sel = $("#moneda");
  sel.innerHTML = MONEDAS.map(function (m) {
    return '<option value="' + m.codigo + '"' +
      (m.codigo === estado.config.moneda ? " selected" : "") + ">" +
      esc(m.nombre) + "</option>";
  }).join("");
}

function sincronizarSelectMoneda() {
  const sel = $("#moneda");
  if (sel) sel.value = estado.config.moneda;
}

function simboloDeMoneda(codigo) {
  const moneda = MONEDAS.filter(function (m) { return m.codigo === codigo; })[0];
  return moneda && moneda.simbolo ? moneda.simbolo : "$";
}

function actualizarSimboloMonto() {
  const simbolo = $("#simbolo-monto");
  if (simbolo) simbolo.textContent = simboloDeMoneda(estado.config.moneda);
}

/* ---------- Modal de enlace compartible ---------- */

function abrirModalEnlace() {
  $("#modal-texto").value = crearEnlace(estado.config);
  $("#modal").hidden = false;
  document.body.style.overflow = "hidden";
  agregarBotonCompartir();
}

function cerrarModal() {
  $("#modal").hidden = true;
  document.body.style.overflow = "";
}

/* Añade un boton nativo de "Compartir" solo si el dispositivo lo soporta. */
function agregarBotonCompartir() {
  const contenedor = $(".modal-acciones");
  if (!contenedor || !navigator.share || $("#modal-compartir")) return;
  const boton = document.createElement("button");
  boton.id = "modal-compartir";
  boton.className = "btn-secundario";
  boton.textContent = "Compartir…";
  boton.addEventListener("click", async function () {
    try {
      await navigator.share({
        title: "GastaMejor — mi distribución de gastos",
        text: "Esta es mi distribución de gastos:",
        url: $("#modal-texto").value,
      });
    } catch (_) {
      /* el usuario canceló o no se pudo compartir: no pasa nada */
    }
  });
  contenedor.appendChild(boton);
}

async function copiarEnlace() {
  const texto = $("#modal-texto");
  texto.focus();
  texto.select();
  texto.setSelectionRange(0, texto.value.length);

  // 1) API moderna (solo en contexto seguro: https o localhost).
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto.value);
      toast("Enlace copiado ✔");
      return;
    } catch (_) {
      /* cae al respaldo */
    }
  }

  // 2) Respaldo clasico (funciona abriendo el archivo local con doble clic).
  let copiado = false;
  try {
    copiado = document.execCommand("copy");
  } catch (_) {
    copiado = false;
  }
  if (copiado) toast("Enlace copiado ✔");
  else toast("Selecciona el texto y cópialo manualmente.");
}

/* ---------- Eventos ---------- */

function iniciarEventos() {
  // Ingreso
  $("#btn-distribuir").addEventListener("click", distribuir);
  $("#monto").addEventListener("keydown", function (e) {
    if (e.key === "Enter") distribuir();
  });
  $("#monto").addEventListener("input", function () { aplicarFormatoMonto(this); });
  $("#monto").addEventListener("blur", function () { completarMonto(this); });

  // Resultado
  $("#btn-ajustar").addEventListener("click", function () {
    mostrarPantalla("ajustar");
  });
  $("#btn-nuevo").addEventListener("click", function () {
    mostrarPantalla("ingreso");
    $("#monto").focus();
  });

  // Edicion de categorias (delegacion)
  $("#ajustar-lista").addEventListener("input", function (e) {
    const input = e.target;
    const idx = Number(input.dataset.idx);
    const categoria = estado.config.categorias[idx];
    if (!categoria) return;

    if (input.dataset.ajuste === "nombre") {
      categoria.nombre = input.value.trim();
      input.classList.toggle("campo-vacio", input.value.trim() === "");
    } else if (input.dataset.ajuste === "porcentaje") {
      let valor = Number(input.value);
      if (isNaN(valor)) valor = 0;
      categoria.porcentaje = Math.min(100, Math.max(0, valor));
      reiniciarPlan();
      actualizarTodosLosDerivados();
      actualizarSuma();
      actualizarPanelLateral();
    } else if (input.dataset.ajuste === "monto") {
      aplicarFormatoMonto(input);
      const valor = parsearEntradaMonto(input.value);
      categoria.monto = valor === null ? 0 : Math.max(0, valor);
      reiniciarPlan();
      actualizarTodosLosDerivados();
      actualizarSuma();
      actualizarPanelLateral();
    }
  });

  // Al salir de un monto, se completa con 2 decimales (1.000,00).
  $("#ajustar-lista").addEventListener("focusout", function (e) {
    const input = e.target;
    if (input && input.dataset && input.dataset.ajuste === "monto") {
      completarMonto(input);
    }
  });

  $("#ajustar-lista").addEventListener("change", function (e) {
    const control = e.target;
    if (control.dataset.ajuste === "grupo") {
      const categoria = estado.config.categorias[Number(control.dataset.idx)];
      if (categoria) {
        categoria.grupo = control.value;
        if (categoria.grupo !== "ahorro") categoria.monedaMonto = "ARS";
        reiniciarPlan();
        renderAjustar();
      }
    }
  });

  $("#ajustar-lista").addEventListener("click", function (e) {
    // Interruptor de modo (% / $)
    const modoBoton = e.target.closest(".modo-btn");
    if (modoBoton) {
      const categoria = estado.config.categorias[Number(modoBoton.dataset.idx)];
      if (categoria && categoria.modo !== modoBoton.dataset.modo) {
        categoria.modo = modoBoton.dataset.modo;
        if (categoria.modo !== "fijo") categoria.monedaMonto = "ARS";
        reiniciarPlan();
        renderAjustar();
      }
      return;
    }

    // Cambiar la moneda del monto (AR$ / US$) en categorias de ahorro
    const botonMoneda = e.target.closest("[data-moneda-idx]");
    if (botonMoneda) {
      const categoria = estado.config.categorias[Number(botonMoneda.dataset.monedaIdx)];
      if (categoria) {
        cambiarMonedaMonto(categoria);
        reiniciarPlan();
        renderAjustar();
      }
      return;
    }

    // Eliminar categoria
    const botonBorrar = e.target.closest("[data-borrar]");
    if (botonBorrar) {
      const idx = Number(botonBorrar.dataset.borrar);
      if (estado.config.categorias.length <= 1) {
        toast("Debe existir al menos una categoría.");
        return;
      }
      estado.config.categorias.splice(idx, 1);
      reiniciarPlan();
      renderAjustar();
    }
  });

  // Agregar categorias
  $("#btn-agregar").addEventListener("click", function () {
    estado.config.categorias.push({
      id: "cat_" + Date.now(),
      nombre: "Nueva categoría",
      grupo: "deseo",
      modo: "porcentaje",
      porcentaje: 0,
      monto: 0,
      monedaMonto: "ARS",
    });
    reiniciarPlan();
    renderAjustar();
    const ultimo = $("#ajustar-lista").lastElementChild;
    if (ultimo) {
      const nombreInput = ultimo.querySelector(".ajuste-nombre");
      if (nombreInput) nombreInput.focus();
    }
  });

  $("#btn-catalogo").addEventListener("click", abrirCatalogo);

  $("#catalogo-lista").addEventListener("click", function (e) {
    const boton = e.target.closest("[data-nombre]");
    if (!boton) return;
    const nombre = boton.dataset.nombre;
    const item = CATALOGO.filter(function (c) { return c.nombre === nombre; })[0];
    if (!item) return;

    const existe = estado.config.categorias.some(function (c) {
      return c.nombre.trim().toLowerCase() === item.nombre.toLowerCase();
    });
    if (existe) {
      toast("Ya tienes esa categoría.");
      return;
    }
    estado.config.categorias.push({
      id: "cat_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      nombre: item.nombre,
      grupo: item.grupo,
      modo: item.modo,
      porcentaje: 0,
      monto: 0,
      monedaMonto: "ARS",
    });
    reiniciarPlan();
    renderAjustar();
    const ultimo = $("#ajustar-lista").lastElementChild;
    if (ultimo) {
      const input = ultimo.querySelector(".ajuste-pct");
      if (input) input.focus();
    }
  });

  $("#catalogo-cerrar").addEventListener("click", cerrarCatalogo);
  $("#modal-catalogo").addEventListener("click", function (e) {
    if (e.target === $("#modal-catalogo")) cerrarCatalogo();
  });

  $("#btn-guardar").addEventListener("click", function () {
    const vacias = estado.config.categorias.filter(function (c) {
      return c.nombre.trim() === "";
    });
    if (vacias.length) {
      toast("Pon nombre a todas las categorías.");
      return;
    }
    guardarConfig(estado.config);
    toast("Guardado en este dispositivo ✔");
    mostrarPantalla("ingreso");
    $("#monto").focus();
  });

  // Perfiles de reparto y plan de evolución
  $("#perfiles").addEventListener("click", function (e) {
    const boton = e.target.closest("[data-perfil]");
    if (boton) aplicarPerfil(boton.dataset.perfil);
  });
  $("#plan-meses").addEventListener("input", function () {
    reiniciarPlan();
    renderPlan();
  });
  $("#btn-paso").addEventListener("click", aplicarProximoPaso);

  // Barra de pestañas (celular) y objetivo del consejero
  $("#tabbar").addEventListener("click", function (e) {
    const boton = e.target.closest("[data-tab]");
    if (boton) mostrarPestana(boton.dataset.tab);
  });
  $("#objetivo-perfil").addEventListener("change", function (e) {
    estado.config.objetivo = e.target.value;
    guardarConfig(estado.config);
    renderConsejero();
  });

  // Historial financiero (zona izquierda, siempre visible)
  $("#btn-guardar-mes").addEventListener("click", function () {
    guardarMesActual();
    renderHistorial();
    actualizarPanelLateral();
  });
  $("#hist-anio-prev").addEventListener("click", function () {
    histAnio -= 1;
    histMesSel = null;
    renderHistorial();
  });
  $("#hist-anio-next").addEventListener("click", function () {
    histAnio += 1;
    histMesSel = null;
    renderHistorial();
  });
  $("#hist-calendario").addEventListener("click", function (e) {
    const celda = e.target.closest("[data-mes]");
    if (celda && !celda.disabled) {
      histMesSel = celda.dataset.mes;
      renderHistorial();
    }
  });

  // Datos
  $("#btn-datos").addEventListener("click", function () {
    mostrarPantalla("datos");
  });
  $("#moneda").addEventListener("change", function (e) {
    estado.config.moneda = e.target.value;
    // El ahorro en dólares solo aplica cuando el ingreso está en pesos.
    if (estado.config.moneda !== "ARS") {
      estado.config.categorias.forEach(function (c) { c.monedaMonto = "ARS"; });
    }
    reiniciarPlan();
    guardarConfig(estado.config);
    actualizarSimboloMonto();
    toast("Moneda actualizada ✔");
  });
  $("#btn-exportar").addEventListener("click", function () {
    descargarImagenReparto();
  });
  $("#btn-enlace").addEventListener("click", abrirModalEnlace);

  // Cotización del dólar (para el ahorro en USD)
  $("#dolar-tipo").addEventListener("change", function (e) {
    estado.config.dolarTipo = e.target.value;
    guardarConfig(estado.config);
    actualizarCotizacion(true);
  });
  $("#btn-refrescar").addEventListener("click", function () {
    actualizarCotizacion(true);
    toast("Actualizando cotización…");
  });
  $("#btn-cotizacion-manual").addEventListener("click", usarCotizacionManual);
  $("#cotizacion-input").addEventListener("input", function () { aplicarFormatoMonto(this); });
  $("#cotizacion-input").addEventListener("blur", function () { completarMonto(this); });

  // Modal de enlace
  $("#modal-copiar").addEventListener("click", copiarEnlace);
  $("#modal-cerrar").addEventListener("click", cerrarModal);
  $("#modal").addEventListener("click", function (e) {
    if (e.target === $("#modal")) cerrarModal();
  });

  // Teclado: el tour se navega con flechas y Escape; Escape cierra modales.
  document.addEventListener("keydown", function (e) {
    const tour = $("#tour");
    if (tour && !tour.hidden) {
      if (e.key === "Escape") { saltarTour(); return; }
      if (e.key === "ArrowRight") { pasoSiguiente(); return; }
      if (e.key === "ArrowLeft") { pasoAnterior(); return; }
      return;
    }
    if (e.key !== "Escape") return;
    const catalogo = $("#modal-catalogo");
    if (!catalogo.hidden) { cerrarCatalogo(); return; }
    const modal = $("#modal");
    if (!modal.hidden) cerrarModal();
  });

  // Tour guiado
  const tSaltar = $("#tour-saltar");
  if (tSaltar) tSaltar.addEventListener("click", saltarTour);
  const tSig = $("#tour-siguiente");
  if (tSig) tSig.addEventListener("click", pasoSiguiente);
  const tAnt = $("#tour-anterior");
  if (tAnt) tAnt.addEventListener("click", pasoAnterior);
  const tBtn = $("#btn-tour");
  if (tBtn) tBtn.addEventListener("click", function () { tourIndice = 0; iniciarTour(); });
  window.addEventListener("resize", function () {
    const t = $("#tour"); if (t && !t.hidden) actualizarFocoTour();
  });
  window.addEventListener("scroll", function () {
    const t = $("#tour"); if (t && !t.hidden) actualizarFocoTour();
  }, true);

  // Volver: si estás en una pestaña lateral, vuelve a Reparto.
  $("#btn-atras").addEventListener("click", function () {
    if (pestanaActiva !== "reparto") { mostrarPestana("reparto"); return; }
    const nombre = pantallaRepartoActual();
    if (nombre === "ajustar" && estado.monto > 0) mostrarPantalla("resultado");
    else mostrarPantalla("ingreso");
  });
}

/* ---------- Tour guiado de primera vez ----------
   Estilo "juego": resalta un elemento (foco) y muestra un globo con la
   explicacion. Aparece la primera vez, mientras el usuario no tenga
   historial. Se puede saltar, retroceder y avanzar. */

const PASOS_TOUR = [
  {
    sel: "#monto", tab: "reparto", pantalla: "ingreso",
    titulo: "Escribí tu dinero del mes",
    texto: "Poné cuánto vas a tener este mes. La app calcula cuánto destinar a cada gasto y lo escribe con formato 1.000.000,00.",
  },
  {
    sel: "#moneda", tab: "reparto", pantalla: "ingreso",
    titulo: "Elegí la moneda",
    texto: "Por defecto pesos argentinos (ARS). Cambiala si cobrás en otra moneda: todos los montos se muestran en esa moneda.",
  },
  {
    sel: "#btn-distribuir", tab: "reparto", pantalla: "ingreso",
    titulo: "Distribuí tu dinero",
    texto: "Un toque y ves tu reparto en un gráfico de torta con subtotales por grupo: necesidades, deseos y ahorro.",
  },
  {
    sel: "#perfiles", tab: "perfil",
    titulo: "Perfiles de reparto",
    texto: "Atajos de un toque (Gastador, Equilibrado, Conservador, Cauto) que reparten tus porcentajes por grupo. Los montos fijos no se tocan.",
  },
  {
    sel: "#plan-timeline", tab: "perfil",
    titulo: "Plan de evolución",
    texto: "Te acerca de a poco al ideal 50/30/20: elegís en cuántos meses y avanzás paso a paso, viendo cuánto cambia cada categoría.",
  },
  {
    sel: "#consejero", tab: "perfil",
    titulo: "Consejero",
    texto: "Te dice dónde recortar para llegar a tu objetivo, con consejos concretos y el monto sugerido.",
  },
  {
    sel: "#hist-calendario", tab: "historial",
    titulo: "Tu historial",
    texto: "Guardá cada mes desde el resultado y mirá tu evolución y tu ahorro en el calendario.",
  },
  {
    sel: "#btn-reportar",
    titulo: "¿Algo falla?",
    texto: "Si encontrás un problema, tocá este botón y me escribís por WhatsApp.",
  },
];

let tourIndice = 0;
let tourPasos = [];

/* ¿Corresponde mostrar el tour? Solo si no tiene historial y no lo vio antes. */
function tourDisponible() {
  return !tourVisto() && cargarHistorial().length === 0;
}

function iniciarTour() {
  const cont = $("#tour");
  if (!cont) return;
  if (window.__SIN_TOUR__) return; // las pruebas lo desactivan
  tourPasos = PASOS_TOUR.filter(function (p) { return document.querySelector(p.sel); });
  if (!tourPasos.length) return;
  cont.hidden = false;
  mostrarPasoTour(0);
}

function finalizarTour() {
  const cont = $("#tour");
  if (cont) cont.hidden = true;
  marcarTourVisto();
  mostrarPestana("reparto");
  mostrarPantalla("ingreso");
}

function saltarTour() {
  finalizarTour();
}

function pasoSiguiente() {
  if (tourIndice >= tourPasos.length - 1) { finalizarTour(); return; }
  mostrarPasoTour(tourIndice + 1);
}

function pasoAnterior() {
  if (tourIndice <= 0) return;
  mostrarPasoTour(tourIndice - 1);
}

function mostrarPasoTour(i) {
  if (i < 0 || i >= tourPasos.length) { finalizarTour(); return; }
  tourIndice = i;
  const paso = tourPasos[i];

  if (paso.tab) mostrarPestana(paso.tab);
  if (paso.pantalla) mostrarPantalla(paso.pantalla);

  const el = document.querySelector(paso.sel);
  if (!el) { pasoSiguiente(); return; }

  $("#tour-paso").textContent = (i + 1) + " de " + tourPasos.length;
  $("#tour-titulo").textContent = paso.titulo;
  $("#tour-texto").textContent = paso.texto;
  $("#tour-anterior").disabled = i === 0;
  $("#tour-siguiente").textContent = i === tourPasos.length - 1 ? "Listo" : "Siguiente";

  if (el.scrollIntoView) el.scrollIntoView({ block: "center", inline: "nearest" });

  actualizarFocoTour();
  setTimeout(actualizarFocoTour, 80);
  setTimeout(actualizarFocoTour, 260);
  setTimeout(function () {
    const btn = $("#tour-siguiente");
    if (btn && !$("#tour").hidden) btn.focus();
  }, 120);
}

/* Coloca el foco sobre el elemento resaltado y el globo cerca. */
function actualizarFocoTour() {
  const paso = tourPasos[tourIndice];
  if (!paso) return;
  const el = document.querySelector(paso.sel);
  const foco = $("#tour-foco");
  const globo = $("#tour-globo");
  if (!el || !foco || !globo || $("#tour").hidden) return;

  const r = el.getBoundingClientRect();
  const pad = 6;
  const focoTop = Math.max(4, r.top - pad);
  const focoLeft = Math.max(4, r.left - pad);
  const focoW = Math.min(window.innerWidth - focoLeft - 4, r.width + pad * 2);
  const focoH = Math.min(window.innerHeight - focoTop - 4, r.height + pad * 2);
  foco.style.top = focoTop + "px";
  foco.style.left = focoLeft + "px";
  foco.style.width = Math.max(24, focoW) + "px";
  foco.style.height = Math.max(24, focoH) + "px";

  const margen = 12;
  const ancho = Math.min(340, window.innerWidth - margen * 2);
  globo.style.width = ancho + "px";
  const alto = globo.getBoundingClientRect().height || 160;

  let arriba; // true = el globo queda arriba del foco (flecha hacia abajo)
  let top;
  if (r.bottom + margen + alto <= window.innerHeight - 8) {
    arriba = false;
    top = r.bottom + margen;
  } else if (r.top - margen - alto >= 8) {
    arriba = true;
    top = r.top - margen - alto;
  } else {
    arriba = r.top > window.innerHeight / 2;
    top = arriba ? Math.max(8, r.top - margen - alto) : Math.min(window.innerHeight - alto - margen, r.bottom + margen);
  }

  let left = r.left + r.width / 2 - ancho / 2;
  left = Math.max(margen, Math.min(left, window.innerWidth - ancho - margen));

  globo.style.top = Math.max(8, top) + "px";
  globo.style.left = left + "px";
  globo.classList.toggle("tour-globo-abajo", arriba);

  const flecha = globo.querySelector(".tour-flecha");
  if (flecha) {
    const centro = r.left + r.width / 2 - left;
    flecha.style.left = Math.max(18, Math.min(centro - 8, ancho - 26)) + "px";
  }
}

/* ---------- Arranque ---------- */

function init() {
  // Si la URL trae una configuracion compartida, ofrecer usarla.
  const compartida = configDesdeEnlace();
  if (compartida) {
    const usar = confirm("Tienes una configuración compartida en este enlace. ¿Quieres usarla?");
    if (usar) {
      estado.config = compartida;
      guardarConfig(compartida);
      sincronizarSelectMoneda();
      actualizarSimboloMonto();
      toast("Configuración compartida aplicada ✔");
    }
    limpiarEnlace();
  }

  if (!estado.config) estado.config = cargarConfig();
  construirSelectMoneda();
  actualizarSimboloMonto();
  iniciarEventos();
  iniciarCotizacion();
  renderHistorial();
  mostrarPantalla("ingreso");

  // Tour guiado la primera vez: solo si todavia no guardo ningun mes.
  if (cargarHistorial().length > 0) marcarTourVisto();
  if (tourDisponible()) {
    setTimeout(iniciarTour, 600);
  } else {
    $("#monto").focus();
  }
}

document.addEventListener("DOMContentLoaded", init);