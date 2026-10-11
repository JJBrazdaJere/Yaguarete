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

function fmtPct(p) {
  return Number(p === undefined || p === null ? 0 : p).toLocaleString("es") + "%";
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

/* ---------- Logica de reparto ----------
   Regla: los montos fijos se reservan PRIMERO (son los gastos
   obligatorios). El dinero que queda se reparte entre las
   categorias porcentuales en proporcion a su %, se estira para
   usar todo el ingreso. Asi el total nunca supera el 100%
   (salvo que los fijos solos superen el ingreso). */

function calcularReparto(cfg, ingreso) {
  const sumaFijos = cfg.categorias.reduce(function (acum, c) {
    return c.modo === "fijo" ? acum + (Number(c.monto) || 0) : acum;
  }, 0);
  const sumaPct = cfg.categorias.reduce(function (acum, c) {
    return c.modo === "porcentaje" ? acum + (Number(c.porcentaje) || 0) : acum;
  }, 0);
  const disponible = ingreso - sumaFijos;

  const montoCategoria = cfg.categorias.map(function (c) {
    if (c.modo === "fijo") return Number(c.monto) || 0;
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

/* ---------- Navegacion entre pantallas ---------- */

function mostrarPantalla(nombre) {
  document.querySelectorAll("[data-pantalla]").forEach(function (sec) {
    sec.hidden = sec.getAttribute("data-pantalla") !== nombre;
  });
  $("#btn-atras").hidden = nombre === "ingreso";
  if (nombre === "resultado") {
    renderResultado();
    renderRecomendaciones();
  } else if (nombre === "ajustar") renderAjustar();
  window.scrollTo({ top: 0 });
}

/* ---------- Pantalla 1: ingreso ---------- */

function distribuir() {
  const monto = Number($("#monto").value);
  const error = $("#error-monto");
  if (!isFinite(monto) || monto <= 0) {
    error.hidden = false;
    $("#monto").focus();
    return;
  }
  error.hidden = true;
  estado.monto = monto;
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
      const fila = document.createElement("div");
      fila.className = "fila";
      fila.innerHTML =
        '<span class="fila-dot" style="background:' + colorDeCategoria(index) + '" aria-hidden="true"></span>' +
        '<div class="fila-info">' +
        '<span class="fila-nombre">' + esc(c.nombre) + "</span>" +
        '<span class="fila-pct">' + fmtPct(pctEquiv) + "</span>" +
        "</div>" +
        '<span class="fila-monto">' + dinero(cfg.moneda, montoCategoria) + "</span>";
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

/* ---------- Recomendaciones para gastar mejor ---------- */

const IDEAL_GRUPO = { necesidad: 50, deseo: 30, ahorro: 20 };
const LIMITE_GRUPO = { necesidad: 55, deseo: 35, ahorro: 15 };

function calcularSubtotalesGrupo(reparto, cfg) {
  const porGrupo = { necesidad: 0, deseo: 0, ahorro: 0 };
  cfg.categorias.forEach(function (c, i) {
    porGrupo[c.grupo || "necesidad"] += reparto.montoCategoria[i];
  });
  return porGrupo;
}

function recomendaciones(reparto, cfg, ingreso) {
  const moneda = cfg.moneda;
  const salida = [];

  if (ingreso <= 0) {
    salida.push({
      tipo: "aviso",
      texto: "Cargá tu ingreso del mes y distribuí tu dinero para recibir recomendaciones personalizadas.",
    });
    return salida;
  }

  if (reparto.restante < -0.01) {
    salida.push({
      tipo: "error",
      texto: "Tus gastos fijos superan tu ingreso por <strong>" + dinero(moneda, -reparto.restante) + "</strong>. Bajá esos montos fijos o aumentá tu ingreso para no endeudarte.",
    });
    return salida;
  }

  if (reparto.restante > 0.01) {
    salida.push({
      tipo: "aviso",
      texto: "Te quedan <strong>" + dinero(moneda, reparto.restante) + "</strong> sin repartir. Destiná ese sobrante a ahorro o a una meta concreta.",
    });
  }

  const porGrupo = calcularSubtotalesGrupo(reparto, cfg);

  if (reparto.sumaFijos / ingreso > 0.55) {
    salida.push({
      tipo: "aviso",
      texto:
        "Estos gastos fijos suman <strong>" + dinero(moneda, reparto.sumaFijos) + "</strong> = " +
        fmtPct((reparto.sumaFijos / ingreso) * 100) + " de tus ingresos. Lo ideal sería tener gastos fijos por <strong>" +
        dinero(moneda, ingreso * 0.5) + "</strong>, que equivalen al 50% de tus ingresos.",
    });
  }

  const pctNece = (porGrupo.necesidad / ingreso) * 100;
  if (pctNece > LIMITE_GRUPO.necesidad) {
    salida.push({
      tipo: "aviso",
      texto: "Las Necesidades ocupan el <strong>" + fmtPct(pctNece) + "</strong> de tu ingreso. Lo ideal es hasta el 50% (" + dinero(moneda, ingreso * 0.5) + ").",
    });
  }

  const pctDeseo = (porGrupo.deseo / ingreso) * 100;
  if (pctDeseo > LIMITE_GRUPO.deseo) {
    salida.push({
      tipo: "aviso",
      texto: "Los Deseos ocupan el <strong>" + fmtPct(pctDeseo) + "</strong> de tu ingreso. Lo recomendado es hasta el 30% (" + dinero(moneda, ingreso * 0.3) + ").",
    });
  }

  const pctAhorro = (porGrupo.ahorro / ingreso) * 100;
  if (pctAhorro < LIMITE_GRUPO.ahorro) {
    salida.push({
      tipo: "aviso",
      texto: "Ahorrás solo el <strong>" + fmtPct(pctAhorro) + "</strong> del ingreso. Lo recomendado es al menos el 20% (" + dinero(moneda, ingreso * 0.2) + ") para tener un colchón.",
    });
  }

  if (!salida.length) {
    salida.push({
      tipo: "ok",
      texto: "Tu reparto está equilibrado: dentro de lo recomendado (50% necesidades · 30% deseos · 20% ahorro) <strong>💪</strong>.",
    });
  }
  return salida;
}

function renderRecomendaciones() {
  const cont = $("#recomendaciones");
  if (!cont) return;
  const monto = estado.monto || 0;
  const cfg = estado.config;
  const reparto = calcularReparto(cfg, monto);
  const sugerencias = recomendaciones(reparto, cfg, monto);
  cont.innerHTML =
    '<h3 class="recom-titulo">💡 Para gastar mejor</h3>' +
    sugerencias.map(function (s) {
      return '<p class="recom-item recom-' + s.tipo + '">' + s.texto + "</p>";
    }).join("");
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

  // Altura del lienzo (unidades logicas, salida a ESCALA).
  let H = 96 + 86; // cabecera + resumen
  if (exceso || incompleto) H += 38;
  H += 190 + 10; // torta + separacion
  GRUPOS.forEach(function (g, idx) {
    if (filasPorGrupo[idx].length) H += tituloGrupoAlto + filasPorGrupo[idx].length * filaAlto;
  });
  if (incompleto) H += filaAlto;
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
      dibujarTextoPNG(ctx, fmtPct(pct) + " · " + dinero(moneda, valor), W - M, y, { tamano: 15, peso: 700, color: "#334155", align: "right" });
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

function renderAjustar() {
  const lista = $("#ajustar-lista");
  lista.innerHTML = "";
  const moneda = estado.config.moneda;
  const ingreso = Number(estado.monto) || 0;
  const reparto = calcularReparto(estado.config, ingreso);

  estado.config.categorias.forEach(function (c, i) {
    const esPorcentaje = c.modo === "porcentaje";
    const montoCalc = reparto.montoCategoria[i];
    const pctEquiv = ingreso > 0 ? (montoCalc / ingreso) * 100 : 0;

    const fila = document.createElement("div");
    fila.className = "fila-ajuste";
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
          '" data-idx="' + i + '" type="number" inputmode="decimal" min="0" step="' +
          (esPorcentaje ? "0.5" : "0.01") + '" value="' + (esPorcentaje ? Number(c.porcentaje) : Number(c.monto)) +
          '" aria-label="Valor">' +
          '<span class="pct-unidad">' + (esPorcentaje ? "%" : "$") + "</span>" +
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
        (esPorcentaje
          ? "= " + dinero(moneda, montoCalc) + " · " + fmtPct(pctEquiv) + " del ingreso"
          : "≈ " + fmtPct(pctEquiv) + " del ingreso") +
      "</div>";

    lista.appendChild(fila);
  });

  actualizarSuma();
}

/* Actualiza solo la linea derivada de una fila (sin perder el foco). */
function actualizarFilaDerivada(fila, c) {
  const moneda = estado.config.moneda;
  const ingreso = Number(estado.monto) || 0;
  const reparto = calcularReparto(estado.config, ingreso);
  const idx = estado.config.categorias.indexOf(c);
  const derivado = fila.querySelector("[data-derivado]");
  const unidad = fila.querySelector(".pct-unidad");
  if (c.modo === "porcentaje") {
    unidad.textContent = "%";
    const monto = reparto.montoCategoria[idx];
    const pctReal = ingreso > 0 ? (monto / ingreso) * 100 : 0;
    derivado.textContent = "= " + dinero(moneda, monto) + " · " + fmtPct(pctReal) + " del ingreso";
  } else {
    unidad.textContent = "$";
    const pct = ingreso > 0 ? ((Number(c.monto) || 0) / ingreso) * 100 : 0;
    derivado.textContent = "≈ " + fmtPct(pct) + " del ingreso";
  }
}

/* Actualiza las lineas derivadas de TODAS las filas (sin perder el foco).
   Los montos se estiran: cambiar una categoria altera el reparto de las demas. */
function actualizarTodosLosDerivados() {
  const filas = $("#ajustar-lista").querySelectorAll(".fila-ajuste");
  filas.forEach(function (fila, i) {
    const categoria = estado.config.categorias[i];
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
      actualizarTodosLosDerivados();
      actualizarSuma();
    } else if (input.dataset.ajuste === "monto") {
      let valor = Number(input.value);
      if (isNaN(valor)) valor = 0;
      categoria.monto = Math.max(0, valor);
      actualizarTodosLosDerivados();
      actualizarSuma();
    }
  });

  $("#ajustar-lista").addEventListener("change", function (e) {
    const control = e.target;
    if (control.dataset.ajuste === "grupo") {
      const categoria = estado.config.categorias[Number(control.dataset.idx)];
      if (categoria) {
        categoria.grupo = control.value;
        actualizarSuma();
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
    });
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
    });
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

  // Datos
  $("#btn-datos").addEventListener("click", function () {
    mostrarPantalla("datos");
  });
  $("#moneda").addEventListener("change", function (e) {
    estado.config.moneda = e.target.value;
    guardarConfig(estado.config);
    actualizarSimboloMonto();
    toast("Moneda actualizada ✔");
  });
  $("#btn-exportar").addEventListener("click", function () {
    descargarImagenReparto();
  });
  $("#btn-importar").addEventListener("click", function () {
    $("#archivo-importar").click();
  });
  $("#archivo-importar").addEventListener("change", async function (e) {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    try {
      const cfg = await importarARCHIVO(archivo);
      estado.config = cfg;
      guardarConfig(cfg);
      sincronizarSelectMoneda();
      actualizarSimboloMonto();
      toast("Configuración importada ✔");
      renderAjustar();
    } catch (error) {
      toast(error.message || "No se pudo importar el archivo.");
    }
  });
  $("#btn-enlace").addEventListener("click", abrirModalEnlace);

  // Modal de enlace
  $("#modal-copiar").addEventListener("click", copiarEnlace);
  $("#modal-cerrar").addEventListener("click", cerrarModal);
  $("#modal").addEventListener("click", function (e) {
    if (e.target === $("#modal")) cerrarModal();
  });

  // Tecla Escape cierra cualquier modal abierto
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    const catalogo = $("#modal-catalogo");
    if (!catalogo.hidden) { cerrarCatalogo(); return; }
    const modal = $("#modal");
    if (!modal.hidden) cerrarModal();
  });

  // Volver: a la pantalla anterior según dónde estés.
  $("#btn-atras").addEventListener("click", function () {
    const actual = document.querySelector(".pantalla:not([hidden])");
    const nombre = actual ? actual.getAttribute("data-pantalla") : "ingreso";
    if (nombre === "ajustar" && estado.monto > 0) mostrarPantalla("resultado");
    else mostrarPantalla("ingreso");
  });
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
  mostrarPantalla("ingreso");
  $("#monto").focus();
}

document.addEventListener("DOMContentLoaded", init);